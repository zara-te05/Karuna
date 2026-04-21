"""
clustering_kmeans.py — K-Means
Stdin: { "alumnos": [...], "nombre_grupo": "...", "k": 3 }
Stdout: { "imagen": "<base64>", "resumen": {...} }
"""
import sys, json, io, base64, warnings
warnings.filterwarnings("ignore")

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
import matplotlib.patches as mpatches
import seaborn as sns
import pandas as pd
import numpy as np

from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score

plt.rcParams.update({
    "figure.facecolor":"#0f0f1a","axes.facecolor":"#1a1a2e","axes.edgecolor":"#2a2a4a",
    "axes.labelcolor":"#c9d1d9","xtick.color":"#8b949e","ytick.color":"#8b949e",
    "text.color":"#c9d1d9","grid.color":"#21262d","grid.linestyle":"--","grid.alpha":0.5,
    "axes.grid":True,"font.family":"DejaVu Sans",
})

COLOR_MAIN = "#D4AF37"
PERFILES = {
    "alto":  {"label":"Alto rendimiento",  "color":"#4ade80"},
    "medio": {"label":"Medio rendimiento", "color":"#60a5fa"},
    "bajo":  {"label":"Bajo rendimiento",  "color":"#f87171"},
}

def preparar(df):
    df = df.copy()
    X  = df[["cal_final","prom_tareas","prom_asist"]].values
    sc = StandardScaler()
    return df, X, sc.fit_transform(X)

def clasificar(cal):
    """Umbrales alineados con DBSCAN: alto ≥80, medio 65–80, bajo <65."""
    if cal >= 80: return "alto"
    if cal >= 65: return "medio"
    return "bajo"

def etiquetar(df, labels):
    df = df.copy(); df["cluster"] = labels
    mapa = {}
    for c in sorted(set(labels)):
        sub = df[df["cluster"]==c]
        mapa[c] = clasificar(sub["cal_final"].mean())
    df["perfil"]   = df["cluster"].map(mapa)
    df["color"]    = df["perfil"].map(lambda p: PERFILES[p]["color"])
    df["etiqueta"] = df["perfil"].map(lambda p: PERFILES[p]["label"])
    return df, mapa

def elbow(X_scaled, k_max=8):
    inercias, sils, ks = [], [], range(2, min(k_max+1, len(X_scaled)))
    for k in ks:
        m = KMeans(n_clusters=k, random_state=42, n_init=10).fit(X_scaled)
        inercias.append(m.inertia_)
        sils.append(silhouette_score(X_scaled, m.labels_))
    return list(ks), inercias, sils

def graficar(df, X_scaled, labels, centers, sil_score, nombre_grupo, k):
    n  = len(df)
    pc = df["color"].values
    pca      = PCA(n_components=2)
    X_pca    = pca.fit_transform(X_scaled)
    cp       = pca.transform(centers)
    var_exp  = pca.explained_variance_ratio_
    ks, iner, sils = elbow(X_scaled)
    patches  = [mpatches.Patch(color=PERFILES[p]["color"], label=PERFILES[p]["label"]) for p in ["alto","medio","bajo"]]

    fig = plt.figure(figsize=(18,14))
    fig.suptitle(f"🔵 {nombre_grupo}  ·  K-Means  ·  k={k}", fontsize=13, fontweight="bold", color=COLOR_MAIN, y=1.005)
    gs = gridspec.GridSpec(3, 4, figure=fig, hspace=0.58, wspace=0.42)

    ax = fig.add_subplot(gs[0,0])
    ax.hist(df["cal_final"], bins=12, color=COLOR_MAIN, edgecolor="#0f0f1a", alpha=0.85)
    ax.axvline(df["cal_final"].mean(), color="#f87171", linestyle="--", lw=1.8, label=f"Media ({df['cal_final'].mean():.1f})")
    ax.axvline(80, color="#4ade80", linestyle=":", lw=1.2, label="Alto (≥80)")
    ax.axvline(65, color="#f87171", linestyle=":", lw=1.2, label="Bajo (<65)")
    ax.set_title("Dist. Calificación Final", color=COLOR_MAIN, fontweight="bold"); ax.legend(fontsize=7)

    ax = fig.add_subplot(gs[0,1])
    cnt = df["perfil"].value_counts().reindex(["alto","medio","bajo"], fill_value=0)
    ax.bar(range(3), cnt.values, color=[PERFILES[p]["color"] for p in cnt.index], edgecolor="#0f0f1a")
    ax.set_xticks(range(3)); ax.set_xticklabels([PERFILES[p]["label"] for p in cnt.index], rotation=15, ha="right", fontsize=8)
    ax.set_title("Alumnos por Perfil", color=COLOR_MAIN, fontweight="bold")
    for i,v in enumerate(cnt.values):
        if v>0: ax.text(i, v+0.15, str(v), ha="center", fontsize=10, fontweight="bold")

    ax = fig.add_subplot(gs[0,2])
    df_melt = df.melt(id_vars="etiqueta", value_vars=["cal_final","prom_tareas","prom_asist"], var_name="v", value_name="val")
    df_melt["v"] = df_melt["v"].map({"cal_final":"Cal.","prom_tareas":"Tareas","prom_asist":"Asist."})
    palette = {PERFILES[p]["label"]:PERFILES[p]["color"] for p in PERFILES}
    orden = [PERFILES[p]["label"] for p in ["alto","medio","bajo"] if PERFILES[p]["label"] in df_melt["etiqueta"].unique()]
    sns.boxplot(data=df_melt, x="v", y="val", hue="etiqueta", hue_order=orden, palette=palette, ax=ax, linewidth=0.9)
    ax.set_title("Variables por Perfil", color=COLOR_MAIN, fontweight="bold"); ax.set_xlabel(""); ax.legend(title="", fontsize=7)

    ax = fig.add_subplot(gs[0,3])
    corr = df[["cal_final","prom_tareas","prom_asist"]].corr()
    sns.heatmap(corr, annot=True, fmt=".2f", cmap="coolwarm", center=0, ax=ax, linewidths=0.5, cbar=False,
                xticklabels=["Cal.","Tareas","Asist."], yticklabels=["Cal.","Tareas","Asist."], annot_kws={"size":9,"color":"#c9d1d9"})
    ax.set_title("Correlación", color=COLOR_MAIN, fontweight="bold")

    ax = fig.add_subplot(gs[1,0:2])
    ax.scatter(X_pca[:,0], X_pca[:,1], c=pc, edgecolors="#0f0f1a", linewidths=0.4, s=65, alpha=0.9)
    ax.scatter(cp[:,0], cp[:,1], c="white", marker="X", s=200, zorder=5, label="Centroide")
    ax.legend(handles=patches+[mpatches.Patch(color="white",label="Centroide")], fontsize=8)
    ax.set_title(f"PCA 2D  ({var_exp[0]*100:.1f}% + {var_exp[1]*100:.1f}% varianza)", color=COLOR_MAIN, fontweight="bold")

    ax = fig.add_subplot(gs[1,2])
    ax.scatter(df["cal_final"], df["prom_asist"], c=pc, edgecolors="#0f0f1a", linewidths=0.4, s=55, alpha=0.9)
    ax.axvline(80, color="#4ade80", linestyle=":", lw=1); ax.axvline(65, color="#f87171", linestyle=":", lw=1)
    ax.set_title("Cal. final vs Asistencia", color=COLOR_MAIN, fontweight="bold"); ax.legend(handles=patches, fontsize=7)

    ax = fig.add_subplot(gs[1,3])
    ax.scatter(df["cal_final"], df["prom_tareas"], c=pc, edgecolors="#0f0f1a", linewidths=0.4, s=55, alpha=0.9)
    ax.axvline(80, color="#4ade80", linestyle=":", lw=1); ax.axvline(65, color="#f87171", linestyle=":", lw=1)
    ax.set_title("Cal. final vs Tareas", color=COLOR_MAIN, fontweight="bold")

    ax = fig.add_subplot(gs[2,0]); ax2 = ax.twinx()
    ax.plot(ks, iner, color="#60a5fa", marker="o", markersize=5, lw=1.5, label="Inercia")
    ax2.plot(ks, sils, color=COLOR_MAIN, marker="s", markersize=5, lw=1.5, linestyle="--", label="Silhouette")
    ax.axvline(k, color="#f87171", linestyle="--", lw=1.2, label=f"k={k}")
    ax.set_title("Elbow Method", color=COLOR_MAIN, fontweight="bold"); ax.set_xlabel("k")
    ax.set_ylabel("Inercia", color="#60a5fa"); ax2.set_ylabel("Silhouette", color=COLOR_MAIN)

    ax = fig.add_subplot(gs[2,1])
    if sil_score is not None:
        c_sil = "#4ade80" if sil_score>=0.5 else "#f97316" if sil_score>=0.3 else "#f87171"
        ax.barh([""], [1], color="#21262d", height=0.4, zorder=0)
        ax.barh([""], [sil_score], color=c_sil, height=0.4, zorder=1)
        ax.axvline(0.5, color="#f97316", linestyle="--", lw=1.2, label="Aceptable (0.5)")
        ax.axvline(0.7, color="#4ade80", linestyle="--", lw=1.2, label="Bueno (0.7)")
        ax.text(sil_score+0.02, 0, f"{sil_score:.3f}", va="center", fontsize=13, fontweight="bold", color=COLOR_MAIN)
        ax.set_xlim(0,1); ax.set_title("Silhouette Score", color=COLOR_MAIN, fontweight="bold"); ax.legend(fontsize=8); ax.set_yticks([])
    else:
        ax.text(0.5,0.5,"No disponible",ha="center",va="center",color="#8b949e"); ax.set_title("Silhouette Score", color=COLOR_MAIN, fontweight="bold"); ax.set_yticks([])

    ax = fig.add_subplot(gs[2,2])
    variables = ["Cal. final","Tareas","Asist."]; cols_raw = ["cal_final","prom_tareas","prom_asist"]
    pp = [p for p in ["alto","medio","bajo"] if p in df["perfil"].values]
    xp = np.arange(len(variables)); ancho = 0.8/len(pp)
    for i,p in enumerate(pp):
        sub = df[df["perfil"]==p]; medias = [sub[c].mean() for c in cols_raw]
        offset = (i-len(pp)/2)*ancho+ancho/2
        ax.bar(xp+offset, medias, width=ancho, color=PERFILES[p]["color"], edgecolor="#0f0f1a", label=PERFILES[p]["label"])
    ax.set_xticks(xp); ax.set_xticklabels(variables); ax.set_ylim(0,115)
    ax.set_title("Perfil Promedio por Categoría", color=COLOR_MAIN, fontweight="bold"); ax.legend(fontsize=7)

    ax = fig.add_subplot(gs[2,3])
    idx_sort = np.argsort(df["cal_final"].values)
    ax.barh(range(n), df["cal_final"].values[idx_sort], color=[pc[i] for i in idx_sort], edgecolor="#0f0f1a", height=0.7, lw=0.3)
    ax.axvline(80, color="#4ade80", linestyle="--", lw=1.2)
    ax.axvline(65, color="#f87171", linestyle="--", lw=1.2)
    ax.legend(handles=patches, fontsize=7, loc="lower right")
    ax.set_title("Cal. por Alumno (ordenado)", color=COLOR_MAIN, fontweight="bold"); ax.set_yticks([])

    plt.tight_layout()
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=130, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def main():
    entrada = json.loads(sys.stdin.read())
    df = pd.DataFrame(entrada.get("alumnos", []))
    for col in ["cal_final","prom_tareas","prom_asist"]:
        if col not in df.columns: df[col] = 0.0
    nombre = entrada.get("nombre_grupo","Grupo")
    k      = int(entrada.get("k", 3))

    df, X, X_sc = preparar(df)
    n_samples = len(X_sc)
    if n_samples == 0:
        print(json.dumps({"error": "No hay alumnos para analizar."}))
        return
        
    k = min(k, n_samples)
    model = KMeans(n_clusters=k, random_state=42, n_init=10)
    labels = model.fit_predict(X_sc)
    
    n_labels = len(set(labels))
    sil = silhouette_score(X_sc, labels) if 1 < n_labels < n_samples else None
    
    df, mapa = etiquetar(df, labels)
    imagen = graficar(df, X_sc, labels, model.cluster_centers_, sil, nombre, k)

    conteos = {p: int((df["perfil"]==p).sum()) for p in ["alto","medio","bajo"]}

    # Datos enriquecidos para gráficas HTML
    if n_samples >= 2:
        pca2 = PCA(n_components=2)
        X_pca2 = pca2.fit_transform(X_sc)
    else:
        X_pca2 = np.zeros((n_samples, 2))
        
    pca_points = [{"x": round(float(X_pca2[i,0]),3), "y": round(float(X_pca2[i,1]),3),
                   "perfil": df["perfil"].values[i], "cal": round(float(df["cal_final"].values[i]),1)}
                  for i in range(n_samples)]
    cal_sorted = sorted([{"cal": round(float(df["cal_final"].values[i]),1),
                          "perfil": df["perfil"].values[i]} for i in range(len(df))],
                        key=lambda x: x["cal"])

    resumen = {"algoritmo":"K-Means","k":k,"silhouette":round(float(sil),4) if sil else None,
               "n_alumnos":len(df),"perfiles":conteos,
               "pca_points":pca_points,"cal_sorted":cal_sorted}
    print(json.dumps({"imagen": imagen, "resumen": resumen}))

if __name__=="__main__":
    main()
