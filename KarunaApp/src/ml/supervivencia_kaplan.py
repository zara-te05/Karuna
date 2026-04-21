"""
supervivencia_kaplan.py — Kaplan-Meier
Stdin: { "alumnos": [...], "nombre_grupo": "..." }
Stdout: { "imagen": "<base64>", "resumen": {...} }
Los campos tiempo/evento se derivan de cal_final, prom_tareas, prom_asist.
"""
import sys, json, io, base64, warnings
warnings.filterwarnings("ignore")

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
import pandas as pd
import numpy as np

from lifelines import KaplanMeierFitter
from lifelines.statistics import multivariate_logrank_test

plt.rcParams.update({
    "figure.facecolor":"#0f0f1a","axes.facecolor":"#1a1a2e","axes.edgecolor":"#2a2a4a",
    "axes.labelcolor":"#c9d1d9","xtick.color":"#8b949e","ytick.color":"#8b949e",
    "text.color":"#c9d1d9","grid.color":"#21262d","grid.linestyle":"--","grid.alpha":0.5,
    "axes.grid":True,"font.family":"DejaVu Sans",
})

COLOR_MAIN = "#D4AF37"


def derivar_tiempos(df: pd.DataFrame) -> pd.DataFrame:
    """
    Deriva tiempos y eventos de forma DETERMINISTA a partir de calificaciones reales.
    No usa random: los tiempos son proporcionales al riesgo calculado desde los datos.

    Modelo:
      - tiempo_rep: semana estimada de reprobación.  Riesgo alto = falla temprano.
      - tiempo_des: semana estimada de deserción.    Riesgo alto = abandona pronto.
      - tiempo_mej: semana estimada de mejora academ. Prob alta = mejora pronto.
      Semana máxima = 16 (semestre). evento=1 si el suceso ocurrió, 0=censurado.
    """
    df   = df.copy()
    cal  = df["cal_final"].values.astype(float)
    tar  = df["prom_tareas"].values.astype(float)
    asi  = df["prom_asist"].values.astype(float)

    # --- Reprobación: riesgo = ponderación de deficiencias ---
    r_rep = np.clip((100 - cal) / 100 * 0.6 + (100 - tar) / 100 * 0.4, 0.01, 0.99)
    # Tiempo inversamente proporcional al riesgo: alto riesgo → semana temprana
    t_rep = np.clip(np.round(16 * (1 - r_rep)).astype(int), 1, 16)
    # Evento: reprobó si cal < 70 (umbral real)
    e_rep = (cal < 70).astype(int)
    # Alumnos sobre 70 son censurados (observados hasta sem. 16 sin reprobar)
    t_rep[e_rep == 0] = 16

    # --- Deserción: riesgo basado en asistencia y calificación ---
    r_des = np.clip((100 - asi) / 100 * 0.5 + (100 - cal) / 100 * 0.3 + (100 - tar) / 100 * 0.2, 0.01, 0.99)
    t_des = np.clip(np.round(16 * (1 - r_des)).astype(int), 1, 16)
    # Proxy de deserción: asistencia < 60%
    e_des = (asi < 60).astype(int)
    t_des[e_des == 0] = 16

    # --- Mejora académica: probabilidad de mejorar (tareas como predictor principal) ---
    r_mej = np.clip(tar / 100 * 0.5 + asi / 100 * 0.3 + cal / 100 * 0.2, 0.01, 0.99)
    t_mej = np.clip(np.round(16 * (1 - r_mej)).astype(int), 1, 16)
    # Evento: alumno con buen desempeño en tareas se consideró que mejoró
    e_mej = (tar >= 75).astype(int)
    t_mej[e_mej == 0] = 16

    df["tiempo_rep"] = t_rep; df["evento_rep"] = e_rep
    df["tiempo_des"] = t_des; df["evento_des"] = e_des
    df["tiempo_mej"] = t_mej; df["evento_mej"] = e_mej
    return df


def segmentar(serie):
    q33, q66 = serie.quantile(0.33), serie.quantile(0.66)
    return pd.cut(serie, bins=[-np.inf, q33, q66, np.inf], labels=["Bajo","Medio","Alto"])


def panel_km(ax, df, t_col, e_col, seg_col, colores, ylabel, titulo):
    grupos = ["Bajo","Medio","Alto"]
    for g, c in zip(grupos, colores):
        mask = df[seg_col]==g
        if mask.sum() < 2: continue
        kmf = KaplanMeierFitter()
        kmf.fit(df.loc[mask, t_col], event_observed=df.loc[mask, e_col], label=g)
        kmf.plot_survival_function(ax=ax, color=c, ci_show=True, ci_alpha=0.1)
    try:
        lr = multivariate_logrank_test(df[t_col], df[seg_col], df[e_col])
        p  = lr.p_value
        sig = "***" if p<0.001 else "**" if p<0.01 else "*" if p<0.05 else "ns"
        ax.set_title(f"{titulo}\np={p:.4f} {sig}", fontsize=9, color=COLOR_MAIN, fontweight="bold")
    except Exception:
        ax.set_title(titulo, fontsize=9, color=COLOR_MAIN, fontweight="bold")
    ax.set_xlabel("Semana", fontsize=8); ax.set_ylabel(ylabel, fontsize=8)
    ax.set_ylim(0,1.05); ax.tick_params(labelsize=7)
    ax.legend(fontsize=7, title="Grupo", title_fontsize=7)
    ax.axhline(0.5, color="#8b949e", linestyle="--", lw=0.7, alpha=0.7)


def panel_km_global(ax, df, t_col, e_col, color, titulo, ylabel):
    kmf = KaplanMeierFitter()
    kmf.fit(df[t_col], event_observed=df[e_col], label="Grupo completo")
    kmf.plot_survival_function(ax=ax, color=color, ci_show=True)
    ax.set_title(titulo, fontsize=9, color=COLOR_MAIN, fontweight="bold")
    ax.set_xlabel("Semana",fontsize=8); ax.set_ylabel(ylabel,fontsize=8)
    ax.set_ylim(0,1.05); ax.tick_params(labelsize=7)
    ax.axhline(0.5, color="#8b949e", linestyle="--", lw=0.7, alpha=0.7)
    med = kmf.median_survival_time_
    if not np.isinf(med):
        ax.axvline(med, color=color, linestyle=":", lw=1.2, alpha=0.8, label=f"Mediana: sem.{int(med)}")
        ax.legend(fontsize=7)


def graficar(df, nombre_grupo):
    df = df.copy()
    df["seg_cal"]    = segmentar(df["cal_final"])
    df["seg_tareas"] = segmentar(df["prom_tareas"])
    df["seg_asist"]  = segmentar(df["prom_asist"])

    pal_rep = ["#fca5a5","#ef4444","#991b1b"]
    pal_des = ["#fcd34d","#f59e0b","#92400e"]
    pal_mej = ["#86efac","#22c55e","#14532d"]

    fig = plt.figure(figsize=(20,16))
    fig.suptitle(f"📊 {nombre_grupo}  ·  Kaplan-Meier  ·  Riesgo estimado desde datos reales",
                 fontsize=13, fontweight="bold", color=COLOR_MAIN, y=1.005)
    gs = gridspec.GridSpec(4, 3, figure=fig, hspace=0.68, wspace=0.38)

    panel_km_global(fig.add_subplot(gs[0,0]), df,"tiempo_rep","evento_rep","#ef4444","Reprobación — grupo completo","P(no reprobar)")
    panel_km_global(fig.add_subplot(gs[0,1]), df,"tiempo_des","evento_des","#f59e0b","Deserción — grupo completo","P(no desertar)")
    panel_km_global(fig.add_subplot(gs[0,2]), df,"tiempo_mej","evento_mej","#22c55e","Mejora — grupo completo","P(aún sin mejorar)")

    rows = [
        ("seg_cal",   "Cal.",   pal_rep, pal_des, pal_mej),
        ("seg_asist", "Asist.", pal_rep, pal_des, pal_mej),
        ("seg_tareas","Tareas", pal_rep, pal_des, pal_mej),
    ]
    for row_i, (seg, label, pr, pd_, pm) in enumerate(rows):
        panel_km(fig.add_subplot(gs[row_i+1,0]), df,"tiempo_rep","evento_rep",seg,pr,"P(no reprobar)",f"Reprobación × {label}")
        panel_km(fig.add_subplot(gs[row_i+1,1]), df,"tiempo_des","evento_des",seg,pd_,"P(no desertar)",f"Deserción × {label}")
        panel_km(fig.add_subplot(gs[row_i+1,2]), df,"tiempo_mej","evento_mej",seg,pm,"P(sin mejorar)",f"Mejora × {label}")

    plt.tight_layout()
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=130, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def main():
    entrada = json.loads(sys.stdin.read())
    df = pd.DataFrame(entrada.get("alumnos",[]))
    for col in ["cal_final","prom_tareas","prom_asist"]:
        if col not in df.columns: df[col] = 0.0
    nombre = entrada.get("nombre_grupo","Grupo")
    df = derivar_tiempos(df)
    imagen = graficar(df, nombre)

    resumen_ev = {}
    for t_col, e_col, nombre_ev in [("tiempo_rep","evento_rep","reprobacion"),
                                     ("tiempo_des","evento_des","desercion"),
                                     ("tiempo_mej","evento_mej","mejora")]:
        kmf = KaplanMeierFitter()
        kmf.fit(df[t_col], event_observed=df[e_col])
        med  = kmf.median_survival_time_
        tasa = float(df[e_col].mean())
        resumen_ev[nombre_ev] = {
            "tasa_evento": round(tasa,4),
            "mediana_semanas": int(med) if not np.isinf(med) else None
        }
    resumen = {"algoritmo":"Kaplan-Meier","n_alumnos":len(df),"eventos":resumen_ev}
    print(json.dumps({"imagen": imagen, "resumen": resumen}))

if __name__=="__main__":
    main()
