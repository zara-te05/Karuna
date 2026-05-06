"""
clasificacion_lr.py — Logistic Regression
Stdin: { "alumnos": [...], "umbral": 70, "nombre_grupo": "..." }
Stdout: { "imagen": "<base64>", "resumen": {...} }
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

from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split, cross_val_score, LeaveOneOut, StratifiedKFold
from sklearn.metrics import confusion_matrix, roc_curve, auc, accuracy_score
from sklearn.preprocessing import StandardScaler
from sklearn.utils import resample

plt.rcParams.update({
    "figure.facecolor":"#0f0f1a","axes.facecolor":"#1a1a2e","axes.edgecolor":"#2a2a4a",
    "axes.labelcolor":"#c9d1d9","xtick.color":"#8b949e","ytick.color":"#8b949e",
    "text.color":"#c9d1d9","grid.color":"#21262d","grid.linestyle":"--","grid.alpha":0.5,
    "axes.grid":True,"font.family":"DejaVu Sans",
})

COLOR_MAIN="#D4AF37"; COLOR_AP="#4ade80"; COLOR_REP="#f87171"


def preparar(df, umbral):
    n=len(df); df=df.copy()
    df["aprueba"]=(df["cal_final"]>=umbral).astype(int)
    X_raw=df[["cal_final","prom_tareas","prom_asist"]]; y=df["aprueba"]
    sc=StandardScaler(); X=pd.DataFrame(sc.fit_transform(X_raw),columns=X_raw.columns)
    clases_unicas = np.unique(y)
    if len(clases_unicas) < 2:
        return df,X,y,X,X,y,y,f"Una sola clase ({n} alumnos) — Sin clasificación útil",False,sc,None
    _, conteos=np.unique(y, return_counts=True)
    min_ratio=conteos.min()/n
    if n < 15 or min_ratio < 0.15:
        k_folds = max(2, min(5, int(conteos.min())))
        return df,X,y,None,None,None,None,f"Datos escasos ({n}) — CV {k_folds}-fold",True,sc,k_folds
    if min_ratio < 0.20:
        clases_unicas, conteos_array = np.unique(y, return_counts=True)
        clase_maj = clases_unicas[conteos_array.argmax()]   # ← valor real de clase (0 o 1)
        clase_min = clases_unicas[conteos_array.argmin()]
        df_maj=df[y==clase_maj]; df_min=df[y==clase_min]
        df_up=resample(df_min,replace=True,n_samples=len(df_maj),random_state=42)
        df_bal=pd.concat([df_maj,df_up])
        X_r2=df_bal[["cal_final","prom_tareas","prom_asist"]]
        X=pd.DataFrame(sc.transform(X_r2),columns=X_r2.columns)
        y=df_bal["aprueba"]; modo=f"Desbalance ({min_ratio:.0%}) — Oversampling"
    else:
        modo=f"Normal ({n}) — Train/Test"
    try:
        Xtr,Xte,ytr,yte=train_test_split(X,y,test_size=0.2,stratify=y,random_state=42)
    except:
        Xtr,Xte,ytr,yte=train_test_split(X,y,test_size=0.2,random_state=42)
    return df,X,y,Xtr,Xte,ytr,yte,modo,False,sc,None


def entrenar(X,y,Xtr,Xte,ytr,yte,loo,k_folds=None):
    m=LogisticRegression(class_weight="balanced",max_iter=500,random_state=42)
    if loo:
        cv = StratifiedKFold(n_splits=k_folds, shuffle=True, random_state=42) if k_folds else LeaveOneOut()
        try:
            sc2=cross_val_score(m,X,y,cv=cv,scoring="accuracy")
        except Exception:
            sc2=np.array([])
        m.fit(X,y)  # refit final — solo para coeficientes
        return {"model":m,"scores_loo":sc2,"y_pred":m.predict(X),"y_prob":m.predict_proba(X)[:,1],
                "y_test":y, "acc_from_cv": True}
    m.fit(Xtr,ytr)
    return {"model":m,"scores_loo":None,"y_pred":m.predict(Xte),"y_prob":m.predict_proba(Xte)[:,1],
            "y_test":yte, "acc_from_cv": False}


def graficar(df,res,nombre,modo,umbral):
    n=len(df); m=res["model"]
    yp=np.array(res["y_pred"]); ypr=np.array(res["y_prob"]); yt=np.array(res["y_test"]); sl=res["scores_loo"]
    coefs=m.coef_[0]

    fig=plt.figure(figsize=(18,14))
    fig.suptitle(f"📐 {nombre}  ·  Logistic Regression  ·  {modo}",fontsize=13,fontweight="bold",color=COLOR_MAIN,y=1.005)
    gs=gridspec.GridSpec(3,4,figure=fig,hspace=0.58,wspace=0.42)

    ax=fig.add_subplot(gs[0,0])
    ax.hist(df["cal_final"],bins=12,color=COLOR_MAIN,edgecolor="#0f0f1a",alpha=0.85)
    ax.axvline(umbral,color=COLOR_REP,linestyle="--",lw=1.8,label=f"Mínimo ({umbral})")
    ax.axvline(df["cal_final"].mean(),color=COLOR_AP,linestyle=":",lw=1.8,label=f"Media ({df['cal_final'].mean():.1f})")
    ax.set_title("Dist. Calificación Final",color=COLOR_MAIN,fontweight="bold"); ax.legend(fontsize=8)

    ax=fig.add_subplot(gs[0,1])
    cnt=df["aprueba"].value_counts().sort_index()
    labels_pie=[]; sizes_pie=[]; colors_pie=[]
    if 0 in cnt.index: labels_pie.append("Reprueba"); sizes_pie.append(cnt[0]); colors_pie.append(COLOR_REP)
    if 1 in cnt.index: labels_pie.append("Aprueba");  sizes_pie.append(cnt[1]); colors_pie.append(COLOR_AP)
    if sizes_pie:
        ax.pie(sizes_pie,labels=labels_pie,autopct="%1.1f%%",colors=colors_pie,startangle=90,
               wedgeprops={"edgecolor":"#0f0f1a","linewidth":2},textprops={"color":"#c9d1d9"})
    ax.set_title("Aprueba/Reprueba",color=COLOR_MAIN,fontweight="bold")

    ax=fig.add_subplot(gs[0,2])
    dm=df.melt(id_vars="aprueba",value_vars=["cal_final","prom_tareas","prom_asist"],var_name="v",value_name="val")
    dm["v"]=dm["v"].map({"cal_final":"Cal.","prom_tareas":"Tareas","prom_asist":"Asist."})
    dm["r"]=dm["aprueba"].map({1:"Aprueba",0:"Reprueba"})
    sns.boxplot(data=dm,x="v",y="val",hue="r",palette={"Aprueba":COLOR_AP,"Reprueba":COLOR_REP},ax=ax,linewidth=0.9)
    ax.set_title("Variables por Resultado",color=COLOR_MAIN,fontweight="bold"); ax.set_xlabel(""); ax.legend(title="",fontsize=8)

    ax=fig.add_subplot(gs[0,3])
    corr=df[["cal_final","prom_tareas","prom_asist","aprueba"]].corr()
    sns.heatmap(corr,annot=True,fmt=".2f",cmap="coolwarm",center=0,ax=ax,linewidths=0.5,cbar=False,
                xticklabels=["Cal.","Tareas","Asist.","Apr."],yticklabels=["Cal.","Tareas","Asist.","Apr."],annot_kws={"size":9,"color":"#c9d1d9"})
    ax.set_title("Correlación",color=COLOR_MAIN,fontweight="bold")

    ax=fig.add_subplot(gs[1,0])
    if len(np.unique(yt)) >= 2:
        sns.heatmap(confusion_matrix(yt,yp),annot=True,fmt="d",cmap="YlOrRd",ax=ax,linewidths=0.5,
                    xticklabels=["Reprueba","Aprueba"],yticklabels=["Reprueba","Aprueba"],annot_kws={"size":12,"color":"#0f0f1a"})
    else:
        ax.text(0.5,0.5,"Una sola clase\nen datos",ha="center",va="center",color="#8b949e")
    ax.set_title("Matriz de Confusión",color=COLOR_MAIN,fontweight="bold")

    ax=fig.add_subplot(gs[1,1])
    if (yt==0).sum()>0: ax.hist(ypr[yt==0],bins=10,alpha=0.75,color=COLOR_REP,label="Reprueba real")
    if (yt==1).sum()>0: ax.hist(ypr[yt==1],bins=10,alpha=0.75,color=COLOR_AP,label="Aprueba real")
    ax.axvline(0.5,color="white",linestyle="--",lw=1.2)
    ax.set_title("P(aprueba)",color=COLOR_MAIN,fontweight="bold"); ax.legend(fontsize=8)

    ax=fig.add_subplot(gs[1,2])
    if len(np.unique(yt))==2:
        fpr,tpr,_=roc_curve(yt,ypr); ra=auc(fpr,tpr)
        ax.plot(fpr,tpr,color=COLOR_MAIN,lw=2.5,label=f"AUC={ra:.3f}")
        ax.fill_between(fpr,tpr,alpha=0.15,color=COLOR_MAIN)
        ax.plot([0,1],[0,1],color="#8b949e",linestyle="--",lw=1); ax.legend(fontsize=9)
    else:
        ax.text(0.5,0.5,"Una sola clase",ha="center",va="center",color="#8b949e")
    ax.set_title("Curva ROC",color=COLOR_MAIN,fontweight="bold")

    ax=fig.add_subplot(gs[1,3])
    feats=["Cal. final","Tareas","Asistencia"]
    colors=[COLOR_AP if c>0 else COLOR_REP for c in coefs]
    ax.barh(feats,coefs,color=colors,edgecolor="#0f0f1a")
    ax.axvline(0,color="white",lw=0.8)
    ax.set_title("Coeficientes (interpretables)",color=COLOR_MAIN,fontweight="bold")
    for i,v in enumerate(coefs): ax.text(v+(0.02 if v>=0 else -0.05),i,f"{v:.3f}",va="center",fontsize=9)

    ax=fig.add_subplot(gs[2,0:2])
    all_p=m.predict_proba(pd.DataFrame(df[["cal_final","prom_tareas","prom_asist"]].values,columns=["cal_final","prom_tareas","prom_asist"]))[:,1]
    idx=np.argsort(all_p)
    bc=[COLOR_AP if df["aprueba"].values[i]==1 else COLOR_REP for i in idx]
    ax.barh(range(n),all_p[idx],color=bc,edgecolor="#0f0f1a",height=0.7,lw=0.3)
    ax.axvline(0.5,color="white",linestyle="--",lw=1)
    ax.set_title("P(aprueba) por alumno",color=COLOR_MAIN,fontweight="bold"); ax.set_yticks([]); ax.set_xlim(0,1.05)

    ax=fig.add_subplot(gs[2,2])
    sc2=ax.scatter(df["cal_final"],df["prom_asist"],c=df["aprueba"],cmap="RdYlGn",edgecolors="#0f0f1a",lw=0.5,s=60,alpha=0.9)
    ax.axvline(umbral,color="#8b949e",linestyle="--",lw=1)
    ax.set_title("Cal. final vs Asistencia",color=COLOR_MAIN,fontweight="bold")
    plt.colorbar(sc2,ax=ax,label="0=Rep/1=Apr")

    ax=fig.add_subplot(gs[2,3])
    if sl is not None and len(sl)>0:
        ax.plot(range(1,len(sl)+1),sl,marker="o",markersize=4,color=COLOR_MAIN,lw=1.5)
        ax.axhline(sl.mean(),color=COLOR_REP,linestyle="--",lw=1.5,label=f"Media: {sl.mean():.2%}")
        ax.set_title("Accuracy CV",color=COLOR_MAIN,fontweight="bold"); ax.set_ylim(-0.05,1.1); ax.legend(fontsize=8)
    else:
        acc=accuracy_score(yt,yp); cor=int((yp==yt).sum()); inc=len(yt)-cor
        ax.bar(["Correctas","Incorrectas"],[cor,inc],color=[COLOR_AP,COLOR_REP],edgecolor="#0f0f1a",width=0.5)
        ax.set_title(f"Predicciones (Acc:{acc:.2%})",color=COLOR_MAIN,fontweight="bold")
        for i,v in enumerate([cor,inc]): ax.text(i,v+0.1,str(v),ha="center",fontsize=12,fontweight="bold")

    plt.tight_layout()
    buf=io.BytesIO()
    fig.savefig(buf,format="png",dpi=130,bbox_inches="tight",facecolor=fig.get_facecolor())
    plt.close(fig)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def main():
    try:
        e=json.loads(sys.stdin.read())
        df=pd.DataFrame(e.get("alumnos",[]))
        for col in ["cal_final","prom_tareas","prom_asist"]:
            if col not in df.columns: df[col]=0.0
        umbral=e.get("umbral",70); nombre=e.get("nombre_grupo","Grupo")

        n = len(df)
        if n < 5:
            print(json.dumps({
                "error": True,
                "mensaje": f"Logistic Regression necesita al menos 5 alumnos con datos. "
                           f"Este salón solo tiene {n}. Agrega más alumnos y calificaciones para usar este modelo."
            }))
            return

        y_preview = (df["cal_final"] >= umbral).astype(int)
        if len(np.unique(y_preview)) < 2:
            print(json.dumps({
                "error": True,
                "mensaje": "Logistic Regression requiere alumnos que aprueben Y que reprueben. "
                           "Actualmente todos los alumnos tienen el mismo resultado. "
                           "El modelo no puede aprender con una sola clase."
            }))
            return

        df,X,y,Xtr,Xte,ytr,yte,modo,loo,fitted_scaler,k_folds=preparar(df,umbral)
        res=entrenar(X,y,Xtr,Xte,ytr,yte,loo,k_folds)
        imagen=graficar(df,res,nombre,modo,umbral)
        yt=np.array(res["y_test"]); yp=np.array(res["y_pred"])
        # En modo CV/LOO la accuracy real viene del promedio del CV, no de predecir sobre entrenamiento
        if res.get("acc_from_cv") and res["scores_loo"] is not None and len(res["scores_loo"]) > 0:
            acc = float(res["scores_loo"].mean())
        elif len(np.unique(yt)) >= 2:
            acc = float(accuracy_score(yt, yp))
        else:
            acc = None
        coefs=res["model"].coef_[0]

        # Probabilidades por alumno: SIEMPRE escalar con el scaler entrenado
        X_raw = df[["cal_final","prom_tareas","prom_asist"]].values
        X_scaled_for_pred = pd.DataFrame(fitted_scaler.transform(X_raw), columns=["cal_final","prom_tareas","prom_asist"])
        all_p = res["model"].predict_proba(X_scaled_for_pred)[:,1]

        resumen={
            "algoritmo":"Logistic Regression","modo":modo,
            "accuracy":round(acc,4) if acc is not None else None,
            "n_alumnos":len(df),"n_aprueba":int(df["aprueba"].sum()),"n_reprueba":int(len(df)-df["aprueba"].sum()),
            "coeficientes":{"cal_final":round(float(coefs[0]),4),"prom_tareas":round(float(coefs[1]),4),"prom_asist":round(float(coefs[2]),4)},
            "probabilidades":[round(float(p),3) for p in all_p],
            "cal_finals":[round(float(v),1) for v in df["cal_final"].values],
            "prom_asists":[round(float(v),1) for v in df["prom_asist"].values],
            "aprueba_vals":[int(v) for v in df["aprueba"].values],
            "umbral":umbral,
        }
        if res["scores_loo"] is not None and len(res["scores_loo"])>0:
            resumen["cv_scores"]=[round(float(s),4) for s in res["scores_loo"]]
            resumen["cv_mean"]=round(float(res["scores_loo"].mean()),4)

        print(json.dumps({"imagen":imagen,"resumen":resumen}))

    except Exception as exc:
        print(json.dumps({
            "error": True,
            "mensaje": f"El modelo Logistic Regression no pudo ejecutarse con los datos actuales. "
                       f"Esto suele ocurrir cuando hay muy pocos alumnos o todos tienen calificaciones idénticas. "
                       f"Detalle técnico: {str(exc)}"
        }))

if __name__=="__main__":
    main()
