"""
clasificacion_rf.py — Random Forest
Lee datos desde stdin como JSON:
  { "alumnos": [{"cal_final":80,"prom_tareas":75,"prom_asist":90}, ...], "umbral": 70, "nombre_grupo": "MI GRUPO" }
Devuelve por stdout JSON:
  { "imagen": "<base64_png>", "resumen": {...} }
"""
import sys, json, io, base64, warnings
warnings.filterwarnings("ignore")

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
import seaborn as sns
import pandas as pd
import numpy as np

from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, cross_val_score, LeaveOneOut
from sklearn.metrics import classification_report, confusion_matrix, roc_curve, auc, accuracy_score
from sklearn.utils import resample

# ── Estilo visual elegante ──────────────────────────────────────────────────
plt.rcParams.update({
    "figure.facecolor": "#0f0f1a",
    "axes.facecolor":   "#1a1a2e",
    "axes.edgecolor":   "#2a2a4a",
    "axes.labelcolor":  "#c9d1d9",
    "xtick.color":      "#8b949e",
    "ytick.color":      "#8b949e",
    "text.color":       "#c9d1d9",
    "grid.color":       "#21262d",
    "grid.linestyle":   "--",
    "grid.alpha":       0.5,
    "axes.grid":        True,
    "font.family":      "DejaVu Sans",
})

COLOR_MAIN = "#D4AF37"
COLOR_AP   = "#4ade80"
COLOR_REP  = "#f87171"


def preparar_datos(df, umbral):
    n  = len(df)
    df = df.copy()
    df["aprueba"] = (df["cal_final"] >= umbral).astype(int)
    X = df[["cal_final", "prom_tareas", "prom_asist"]]
    y = df["aprueba"]
    _, conteos = np.unique(y, return_counts=True)

    if n < 15:
        return df, X, y, None, None, None, None, f"Datos escasos ({n} alumnos) — LOO CV", True

    min_ratio = conteos.min() / n
    if min_ratio < 0.20:
        clases_unicas, conteos_array = np.unique(y, return_counts=True)
        clase_maj = clases_unicas[conteos_array.argmax()]   # ← valor real de clase (0 o 1)
        clase_min = clases_unicas[conteos_array.argmin()]
        df_maj = df[y == clase_maj]
        df_min = df[y == clase_min]
        df_up  = resample(df_min, replace=True, n_samples=len(df_maj), random_state=42)
        df_bal = pd.concat([df_maj, df_up])
        X = df_bal[["cal_final", "prom_tareas", "prom_asist"]]
        y = df_bal["aprueba"]
        modo = f"Desbalance ({min_ratio:.0%}) — Oversampling"
    else:
        modo = f"Normal ({n} alumnos) — Train/Test split"

    try:
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)
    except ValueError:
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    return df, X, y, X_train, X_test, y_train, y_test, modo, False


def entrenar(X, y, X_train, X_test, y_train, y_test, loo_mode):
    model = RandomForestClassifier(n_estimators=100, class_weight="balanced", random_state=42)
    if loo_mode:
        # Evaluamos con LOO CV — accuracy viene del CV, NO del refit sobre entrenamiento
        scores = cross_val_score(model, X, y, cv=LeaveOneOut(), scoring="accuracy")
        model.fit(X, y)  # refit final sobre todos los datos (para graficar importancias)
        # y_pred / y_prob son para visualización únicamente; se advierte en modo LOO
        return {"model": model, "scores_loo": scores,
                "y_pred": model.predict(X), "y_prob": model.predict_proba(X)[:, 1],
                "y_test": y, "X_test": X, "acc_from_cv": True}
    model.fit(X_train, y_train)
    return {"model": model, "scores_loo": None,
            "y_pred": model.predict(X_test), "y_prob": model.predict_proba(X_test)[:, 1],
            "y_test": y_test, "X_test": X_test, "acc_from_cv": False}


def graficar(df, res, nombre_grupo, modo, umbral):
    n = len(df)
    model      = res["model"]
    y_pred     = np.array(res["y_pred"])
    y_prob     = np.array(res["y_prob"])
    y_test_arr = np.array(res["y_test"])
    scores_loo = res["scores_loo"]

    fig = plt.figure(figsize=(18, 14))
    fig.suptitle(f"🌲 {nombre_grupo}  ·  Random Forest  ·  {modo}",
                 fontsize=13, fontweight="bold", color=COLOR_MAIN, y=1.005)
    gs = gridspec.GridSpec(3, 4, figure=fig, hspace=0.58, wspace=0.42)

    # Fila 0
    ax = fig.add_subplot(gs[0, 0])
    ax.hist(df["cal_final"], bins=12, color=COLOR_MAIN, edgecolor="#0f0f1a", linewidth=0.7, alpha=0.85)
    ax.axvline(umbral, color=COLOR_REP, linestyle="--", linewidth=1.8, label=f"Mínimo ({umbral})")
    ax.axvline(df["cal_final"].mean(), color=COLOR_AP, linestyle=":", linewidth=1.8, label=f"Media ({df['cal_final'].mean():.1f})")
    ax.set_title("Dist. Calificación Final", color=COLOR_MAIN, fontweight="bold")
    ax.legend(fontsize=8)

    ax = fig.add_subplot(gs[0, 1])
    counts = df["aprueba"].value_counts().sort_index()
    wedge_props = {"edgecolor": "#0f0f1a", "linewidth": 2}
    ax.pie(counts, labels=["Reprueba", "Aprueba"], autopct="%1.1f%%",
           colors=[COLOR_REP, COLOR_AP], startangle=90, wedgeprops=wedge_props,
           textprops={"color": "#c9d1d9"})
    ax.set_title("Aprueba / Reprueba", color=COLOR_MAIN, fontweight="bold")

    ax = fig.add_subplot(gs[0, 2])
    df_melt = df.melt(id_vars="aprueba", value_vars=["cal_final","prom_tareas","prom_asist"],
                      var_name="variable", value_name="valor")
    df_melt["variable"] = df_melt["variable"].map({"cal_final":"Cal.","prom_tareas":"Tareas","prom_asist":"Asist."})
    df_melt["resultado"] = df_melt["aprueba"].map({1:"Aprueba",0:"Reprueba"})
    sns.boxplot(data=df_melt, x="variable", y="valor", hue="resultado",
                palette={"Aprueba":COLOR_AP,"Reprueba":COLOR_REP}, ax=ax, linewidth=0.9)
    ax.set_title("Variables por resultado", color=COLOR_MAIN, fontweight="bold")
    ax.set_xlabel("")
    ax.legend(title="", fontsize=8)

    ax = fig.add_subplot(gs[0, 3])
    corr = df[["cal_final","prom_tareas","prom_asist","aprueba"]].corr()
    sns.heatmap(corr, annot=True, fmt=".2f", cmap="coolwarm", center=0, ax=ax,
                linewidths=0.5, cbar=False,
                xticklabels=["Cal.","Tareas","Asist.","Apr."],
                yticklabels=["Cal.","Tareas","Asist.","Apr."],
                annot_kws={"size":9, "color":"#c9d1d9"})
    ax.set_title("Correlación", color=COLOR_MAIN, fontweight="bold")

    # Fila 1
    ax = fig.add_subplot(gs[1, 0])
    cm = confusion_matrix(y_test_arr, y_pred)
    sns.heatmap(cm, annot=True, fmt="d", cmap="YlOrRd", ax=ax, linewidths=0.5,
                xticklabels=["Reprueba","Aprueba"], yticklabels=["Reprueba","Aprueba"],
                annot_kws={"size":12, "color":"#0f0f1a"})
    ax.set_title("Matriz de Confusión", color=COLOR_MAIN, fontweight="bold")

    ax = fig.add_subplot(gs[1, 1])
    mask0 = y_test_arr==0; mask1 = y_test_arr==1
    if mask0.sum() > 0: ax.hist(y_prob[mask0], bins=10, alpha=0.75, color=COLOR_REP, label="Reprueba real")
    if mask1.sum() > 0: ax.hist(y_prob[mask1], bins=10, alpha=0.75, color=COLOR_AP, label="Aprueba real")
    ax.axvline(0.5, color="white", linestyle="--", linewidth=1.2)
    ax.set_title("P(aprueba)", color=COLOR_MAIN, fontweight="bold")
    ax.legend(fontsize=8)

    ax = fig.add_subplot(gs[1, 2])
    if len(np.unique(y_test_arr)) == 2:
        fpr, tpr, _ = roc_curve(y_test_arr, y_prob)
        roc_auc = auc(fpr, tpr)
        ax.plot(fpr, tpr, color=COLOR_MAIN, lw=2.5, label=f"AUC = {roc_auc:.3f}")
        ax.fill_between(fpr, tpr, alpha=0.15, color=COLOR_MAIN)
        ax.plot([0,1],[0,1], color="#8b949e", linestyle="--", lw=1)
        ax.legend(fontsize=9)
    else:
        ax.text(0.5, 0.5, "Una sola clase\nen prueba", ha="center", va="center", color="#8b949e")
    ax.set_title("Curva ROC", color=COLOR_MAIN, fontweight="bold")

    ax = fig.add_subplot(gs[1, 3])
    features     = ["Cal. final", "Tareas", "Asistencia"]
    importancias = model.feature_importances_
    std          = np.std([t.feature_importances_ for t in model.estimators_], axis=0)
    bars = ax.barh(features, importancias, xerr=std, color=[COLOR_AP, COLOR_MAIN, "#818cf8"],
                   edgecolor="#0f0f1a", capsize=4, error_kw={"ecolor":"white","alpha":0.6})
    ax.set_title("Importancia de Variables", color=COLOR_MAIN, fontweight="bold")
    for i, v in enumerate(importancias):
        ax.text(v + std[i] + 0.01, i, f"{v:.3f}", va="center", fontsize=9)

    # Fila 2
    ax = fig.add_subplot(gs[2, 0:2])
    all_prob = model.predict_proba(df[["cal_final","prom_tareas","prom_asist"]])[:,1]
    idx_sort = np.argsort(all_prob)
    bar_cols = [COLOR_AP if df["aprueba"].values[i]==1 else COLOR_REP for i in idx_sort]
    ax.barh(range(n), all_prob[idx_sort], color=bar_cols, edgecolor="#0f0f1a", height=0.7, linewidth=0.3)
    ax.axvline(0.5, color="white", linestyle="--", linewidth=1)
    ax.set_title(f"P(aprueba) por alumno — grupo completo\n(verde=aprueba real, rojo=reprueba real)",
                 color=COLOR_MAIN, fontweight="bold")
    ax.set_yticks([]); ax.set_xlim(0, 1.05)

    ax = fig.add_subplot(gs[2, 2])
    scatter = ax.scatter(df["cal_final"], df["prom_asist"],
                         c=df["aprueba"], cmap="RdYlGn",
                         edgecolors="#0f0f1a", linewidths=0.5, s=60, alpha=0.9)
    ax.axvline(umbral, color="#8b949e", linestyle="--", linewidth=1)
    ax.set_title("Cal. final vs Asistencia", color=COLOR_MAIN, fontweight="bold")
    plt.colorbar(scatter, ax=ax, label="0=Rep / 1=Apr")

    ax = fig.add_subplot(gs[2, 3])
    if scores_loo is not None:
        ax.plot(range(1, len(scores_loo)+1), scores_loo, marker="o", markersize=4, color=COLOR_MAIN, lw=1.5)
        ax.axhline(scores_loo.mean(), color=COLOR_REP, linestyle="--", lw=1.5, label=f"Media: {scores_loo.mean():.2%}")
        ax.set_title("Accuracy LOO", color=COLOR_MAIN, fontweight="bold")
        ax.set_ylim(-0.05, 1.1); ax.legend(fontsize=8)
    else:
        acc = accuracy_score(y_test_arr, y_pred)
        correctos = int((y_pred == y_test_arr).sum())
        incorrectos = len(y_test_arr) - correctos
        ax.bar(["Correctas","Incorrectas"], [correctos, incorrectos],
               color=[COLOR_AP, COLOR_REP], edgecolor="#0f0f1a", width=0.5)
        ax.set_title(f"Predicciones (Accuracy: {acc:.2%})", color=COLOR_MAIN, fontweight="bold")
        for i, v in enumerate([correctos, incorrectos]):
            ax.text(i, v+0.1, str(v), ha="center", fontsize=12, fontweight="bold")

    plt.tight_layout()
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=130, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def main():
    try:
        raw = sys.stdin.read()
        entrada = json.loads(raw)
        alumnos = entrada.get("alumnos", [])
        umbral  = entrada.get("umbral", 70)
        nombre  = entrada.get("nombre_grupo", "Grupo")

        df = pd.DataFrame(alumnos)
        for col in ["cal_final","prom_tareas","prom_asist"]:
            if col not in df.columns:
                df[col] = 0.0

        n = len(df)
        clases = df["aprueba"].unique() if "aprueba" in df.columns else np.unique((df["cal_final"] >= umbral).astype(int))
        if n < 5:
            print(json.dumps({
                "error": True,
                "mensaje": f"Random Forest necesita al menos 5 alumnos con datos. "
                           f"Este salón solo tiene {n}. Agrega más alumnos y calificaciones para usar este modelo."
            }))
            return

        df, X, y, X_train, X_test, y_train, y_test, modo, loo = preparar_datos(df, umbral)

        clases_unicas = np.unique(y)
        if len(clases_unicas) < 2:
            print(json.dumps({
                "error": True,
                "mensaje": "Random Forest requiere alumnos que aprueben Y que reprueben. "
                           "Actualmente todos los alumnos tienen el mismo resultado (todos aprueban o todos reprueban). "
                           "El modelo no puede aprender con una sola clase."
            }))
            return

        res = entrenar(X, y, X_train, X_test, y_train, y_test, loo)
        imagen_b64 = graficar(df, res, nombre, modo, umbral)

        y_pred     = np.array(res["y_pred"])
        y_test_arr = np.array(res["y_test"])
        if res.get("acc_from_cv") and res["scores_loo"] is not None:
            acc = float(res["scores_loo"].mean())
        else:
            acc = float(accuracy_score(y_test_arr, y_pred))
        n_aprueba  = int(df["aprueba"].sum())
        n_reprueba = int(len(df) - n_aprueba)

        probabilidades = res["model"].predict_proba(df[["cal_final","prom_tareas","prom_asist"]])[:,1]
        resumen = {
            "algoritmo":   "Random Forest",
            "modo":        modo,
            "accuracy":    round(acc, 4),
            "n_alumnos":   len(df),
            "n_aprueba":   n_aprueba,
            "n_reprueba":  n_reprueba,
            "importancias": {
                "cal_final":   round(float(res["model"].feature_importances_[0]), 4),
                "prom_tareas": round(float(res["model"].feature_importances_[1]), 4),
                "prom_asist":  round(float(res["model"].feature_importances_[2]), 4),
            },
            "probabilidades": [round(float(p), 3) for p in probabilidades],
        }
        print(json.dumps({"imagen": imagen_b64, "resumen": resumen}))

    except Exception as e:
        print(json.dumps({
            "error": True,
            "mensaje": f"El modelo Random Forest no pudo ejecutarse con los datos actuales. "
                       f"Esto suele ocurrir cuando hay muy pocos alumnos o todos tienen calificaciones idénticas. "
                       f"Detalle técnico: {str(e)}"
        }))

if __name__ == "__main__":
    main()
