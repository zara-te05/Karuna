"""
clustering_dbscan.py — DBSCAN
Stdin: { "alumnos": [...], "nombre_grupo": "...", "eps": 0.8, "min_samples": 3 }
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

from sklearn.cluster import DBSCAN
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score

plt.rcParams.update({
    "figure.facecolor":"#0f0f1a","axes.facecolor":"#1a1a2e","axes.edgecolor":"#2a2a4a",
    "axes.labelcolor":"#c9d1d9","xtick.color":"#8b949e","ytick.color":"#8b949e",
    "text.color":"#c9d1d9","grid.color":"#21262d","grid.linestyle":"--","grid.alpha":0.5,
    "axes.grid":True,"font.family":"DejaVu Sans",
})

COLOR_MAIN="#D4AF37"
PERFILES={
    "alto":   {"label":"Alto rendimiento", "color":"#4ade80"},
    "medio":  {"label":"Medio rendimiento","color":"#60a5fa"},
    "bajo":   {"label":"Bajo rendimiento", "color":"#f87171"},
    "atipico":{"label":"Atípico",          "color":"#9ca3af"},
}

def preparar(df):
    df=df.copy(); X=df[["cal_final","prom_tareas","prom_asist"]].values
    sc=StandardScaler(); return df,X,sc.fit_transform(X)

def clasificar(cal,tar):
    if cal>=80 and tar>=75: return "alto"
    if cal>=65: return "medio"
    return "bajo"

def etiquetar(df,labels):
    df=df.copy(); df["cluster"]=labels; mapa={}
    for c in sorted(set(labels)):
        if c==-1: mapa[c]="atipico"; continue
        sub=df[df["cluster"]==c]; mapa[c]=clasificar(sub["cal_final"].mean(),sub["prom_tareas"].mean())
    df["perfil"]=df["cluster"].map(mapa)
    df["color"]=df["perfil"].map(lambda p:PERFILES[p]["color"])
    df["etiqueta"]=df["perfil"].map(lambda p:PERFILES[p]["label"])
    return df,mapa

def graficar(df,X_sc,labels,nc,no,sil,nombre,eps,ms):
    n=len(df); pc=df["color"].values
    pca=PCA(n_components=2); Xp=pca.fit_transform(X_sc); ve=pca.explained_variance_ratio_
    patches_all=[mpatches.Patch(color=PERFILES[k]["color"],label=PERFILES[k]["label"]) for k in ["alto","medio","bajo","atipico"]]

    fig=plt.figure(figsize=(18,14))
    fig.suptitle(f"🔍 {nombre}  ·  DBSCAN  ·  eps={eps}  min_samples={ms}  |  {nc} clusters  ·  {no} atípicos",
                 fontsize=13,fontweight="bold",color=COLOR_MAIN,y=1.005)
    gs=gridspec.GridSpec(3,4,figure=fig,hspace=0.58,wspace=0.42)

    ax=fig.add_subplot(gs[0,0])
    ax.hist(df["cal_final"],bins=12,color=COLOR_MAIN,edgecolor="#0f0f1a",alpha=0.85)
    ax.axvline(df["cal_final"].mean(),color="#f87171",linestyle="--",lw=1.8,label=f"Media ({df['cal_final'].mean():.1f})")
    ax.axvline(80,color="#4ade80",linestyle=":",lw=1.2,label="Alto (80)"); ax.axvline(65,color="#f87171",linestyle=":",lw=1.2,label="Bajo (65)")
    ax.set_title("Dist. Calificación Final",color=COLOR_MAIN,fontweight="bold"); ax.legend(fontsize=7)

    ax=fig.add_subplot(gs[0,1])
    cnt=df["perfil"].value_counts().reindex(["alto","medio","bajo","atipico"],fill_value=0)
    ax.bar(range(4),cnt.values,color=[PERFILES[p]["color"] for p in cnt.index],edgecolor="#0f0f1a")
    ax.set_xticks(range(4)); ax.set_xticklabels([PERFILES[p]["label"] for p in cnt.index],rotation=15,ha="right",fontsize=8)
    ax.set_title("Alumnos por Perfil",color=COLOR_MAIN,fontweight="bold")
    for i,v in enumerate(cnt.values):
        if v>0: ax.text(i,v+0.15,str(v),ha="center",fontsize=10,fontweight="bold")

    ax=fig.add_subplot(gs[0,2])
    dm=df.melt(id_vars="etiqueta",value_vars=["cal_final","prom_tareas","prom_asist"],var_name="v",value_name="val")
    dm["v"]=dm["v"].map({"cal_final":"Cal.","prom_tareas":"Tareas","prom_asist":"Asist."})
    pal2={PERFILES[k]["label"]:PERFILES[k]["color"] for k in PERFILES}
    orden=[PERFILES[k]["label"] for k in ["alto","medio","bajo","atipico"] if PERFILES[k]["label"] in dm["etiqueta"].unique()]
    sns.boxplot(data=dm,x="v",y="val",hue="etiqueta",hue_order=orden,palette=pal2,ax=ax,linewidth=0.9)
    ax.set_title("Variables por Perfil",color=COLOR_MAIN,fontweight="bold"); ax.set_xlabel(""); ax.legend(title="",fontsize=7)

    ax=fig.add_subplot(gs[0,3])
    corr=df[["cal_final","prom_tareas","prom_asist"]].corr()
    sns.heatmap(corr,annot=True,fmt=".2f",cmap="coolwarm",center=0,ax=ax,linewidths=0.5,cbar=False,
                xticklabels=["Cal.","Tareas","Asist."],yticklabels=["Cal.","Tareas","Asist."],annot_kws={"size":9,"color":"#c9d1d9"})
    ax.set_title("Correlación",color=COLOR_MAIN,fontweight="bold")

    ax=fig.add_subplot(gs[1,0:2])
    ax.scatter(Xp[:,0],Xp[:,1],c=pc,edgecolors="#0f0f1a",lw=0.4,s=65,alpha=0.9)
    ax.legend(handles=patches_all,fontsize=8,loc="best")
    ax.set_title(f"PCA 2D  ({ve[0]*100:.1f}%+{ve[1]*100:.1f}%)",color=COLOR_MAIN,fontweight="bold")

    ax=fig.add_subplot(gs[1,2])
    ax.scatter(df["cal_final"],df["prom_asist"],c=pc,edgecolors="#0f0f1a",lw=0.4,s=55,alpha=0.9)
    ax.axvline(80,color="#4ade80",linestyle=":",lw=1); ax.axvline(65,color="#f87171",linestyle=":",lw=1)
    ax.set_title("Cal. final vs Asistencia",color=COLOR_MAIN,fontweight="bold"); ax.legend(handles=patches_all,fontsize=7)

    ax=fig.add_subplot(gs[1,3])
    ax.scatter(df["cal_final"],df["prom_tareas"],c=pc,edgecolors="#0f0f1a",lw=0.4,s=55,alpha=0.9)
    ax.axvline(80,color="#4ade80",linestyle=":",lw=1); ax.axvline(65,color="#f87171",linestyle=":",lw=1)
    ax.axhline(75,color="#4ade80",linestyle=":",lw=1); ax.axhline(50,color="#f87171",linestyle=":",lw=1)
    ax.set_title("Cal. final vs Tareas",color=COLOR_MAIN,fontweight="bold")

    ax=fig.add_subplot(gs[2,0])
    pp=[p for p in ["alto","medio","bajo","atipico"] if p in df["perfil"].values]
    vars2=["Cal. final","Tareas","Asist."]; cols_r=["cal_final","prom_tareas","prom_asist"]
    xp2=np.arange(len(vars2)); ancho=0.8/len(pp)
    for i,p in enumerate(pp):
        sub=df[df["perfil"]==p]; medias=[sub[c].mean() for c in cols_r]
        offset=(i-len(pp)/2)*ancho+ancho/2
        ax.bar(xp2+offset,medias,width=ancho,color=PERFILES[p]["color"],edgecolor="#0f0f1a",label=PERFILES[p]["label"])
    ax.set_xticks(xp2); ax.set_xticklabels(vars2); ax.set_ylim(0,115)
    ax.set_title("Perfil Promedio",color=COLOR_MAIN,fontweight="bold"); ax.legend(fontsize=7)

    ax=fig.add_subplot(gs[2,1])
    if sil is not None:
        cs="#4ade80" if sil>=0.5 else "#f97316" if sil>=0.3 else "#f87171"
        ax.barh([""],[ 1],color="#21262d",height=0.4,zorder=0)
        ax.barh([""],[ sil],color=cs,height=0.4,zorder=1)
        ax.axvline(0.5,color="#f97316",linestyle="--",lw=1.2,label="Aceptable")
        ax.axvline(0.7,color="#4ade80",linestyle="--",lw=1.2,label="Bueno")
        ax.text(sil+0.02,0,f"{sil:.3f}",va="center",fontsize=13,fontweight="bold",color=COLOR_MAIN)
        ax.set_xlim(0,1); ax.set_title("Silhouette Score",color=COLOR_MAIN,fontweight="bold"); ax.legend(fontsize=8); ax.set_yticks([])
    else:
        ax.text(0.5,0.5,"N/A",ha="center",va="center",color="#8b949e"); ax.set_title("Silhouette Score",color=COLOR_MAIN,fontweight="bold"); ax.set_yticks([])

    ax=fig.add_subplot(gs[2,2:4])
    idx=np.argsort(df["cal_final"].values)
    ax.barh(range(n),df["cal_final"].values[idx],color=[pc[i] for i in idx],edgecolor="#0f0f1a",height=0.7,lw=0.3)
    ax.axvline(80,color="#4ade80",linestyle="--",lw=1.2); ax.axvline(65,color="#f87171",linestyle="--",lw=1.2)
    ax.legend(handles=patches_all,fontsize=7,loc="lower right")
    ax.set_title("Cal. por Alumno (ordenado, coloreado por perfil)",color=COLOR_MAIN,fontweight="bold"); ax.set_yticks([])

    plt.tight_layout()
    buf=io.BytesIO()
    fig.savefig(buf,format="png",dpi=130,bbox_inches="tight",facecolor=fig.get_facecolor())
    plt.close(fig)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def main():
    e=json.loads(sys.stdin.read())
    df=pd.DataFrame(e.get("alumnos",[]))
    for col in ["cal_final","prom_tareas","prom_asist"]:
        if col not in df.columns: df[col]=0.0
    nombre=e.get("nombre_grupo","Grupo"); eps=float(e.get("eps",0.8)); ms=int(e.get("min_samples",3))
    df,X,X_sc=preparar(df)
    n_samples=len(X_sc)
    if n_samples == 0:
        print(json.dumps({"error": "No hay alumnos para analizar."}))
        return

    labels=DBSCAN(eps=eps,min_samples=ms).fit_predict(X_sc)
    nc=len(set(labels))-(1 if -1 in labels else 0); no=int((labels==-1).sum())
    sil=silhouette_score(X_sc,labels) if 1 < len(set(labels)) < n_samples else None
    df,mapa=etiquetar(df,labels)
    imagen=graficar(df,X_sc,labels,nc,no,sil,nombre,eps,ms)
    cnt={p:int((df["perfil"]==p).sum()) for p in ["alto","medio","bajo","atipico"]}

    # Datos enriquecidos para gráficas HTML
    if n_samples >= 2:
        pca2=PCA(n_components=2)
        X_pca2=pca2.fit_transform(X_sc)
    else:
        X_pca2=np.zeros((n_samples, 2))
        
    pca_points=[{"x":round(float(X_pca2[i,0]),3),"y":round(float(X_pca2[i,1]),3),
                 "perfil":df["perfil"].values[i],"cal":round(float(df["cal_final"].values[i]),1)}
                for i in range(n_samples)]
    cal_sorted=sorted([{"cal":round(float(df["cal_final"].values[i]),1),
                        "perfil":df["perfil"].values[i]} for i in range(len(df))],
                      key=lambda x:x["cal"])

    resumen={"algoritmo":"DBSCAN","eps":eps,"min_samples":ms,"n_clusters":nc,"n_atipicos":no,
             "silhouette":round(float(sil),4) if sil else None,"n_alumnos":len(df),"perfiles":cnt,
             "pca_points":pca_points,"cal_sorted":cal_sorted}
    print(json.dumps({"imagen":imagen,"resumen":resumen}))

if __name__=="__main__":
    main()
