# 📊 Dashboard Vivo - Fran Melo

Sistema de dashboard inteligente com visual moderno e funcionalidade de **upload de planilhas mensais**, filtros dinâmicos e visualização de clientes por status, cluster, recomendação e produto.

> 🔄 Atualização automática via upload `.xlsx`  
> 🎯 Filtros por cluster, produto e recomendação  
> 🧠 Inteligência aplicada para facilitar análise comercial

---

## 🚀 Funcionalidades

✅ Upload de planilhas Excel  
✅ Conversão automática para JSON  
✅ Visualização de clientes em cards  
✅ Filtros combináveis (Cluster, Produto, Recomendação)  
✅ Deploy direto no Render

---

## 📂 Estrutura de Pastas

Dashboard/
├── main.py # App Flask
├── requirements.txt # Dependências
├── templates/
│ └── dashboard.html # HTML principal
├── static/
│ ├── styles.css # Estilo do dashboard
│ └── script.js # Lógica dos filtros
├── dados/
│ └── clientes.json # Dados atualizados a partir do upload
├── uploads/
│ └── (planilhas .xlsx)


---

## 📥 Como usar

1. Acesse o sistema em:  
   🔗 [`https://dashboard-vivo.onrender.com`](https://dashboard-vivo.onrender.com)

2. Faça upload da planilha `.xlsx` (modelo padrão com colunas como `RAZAO_SOCIAL`, `TP_PRODUTO`, `CLUSTER`, etc.)

3. Os dados são convertidos em JSON e usados automaticamente no painel.

---

## 📌 Tecnologias utilizadas

- Python 3.13
- Flask
- Pandas
- OpenPyXL
- HTML + CSS + JS Vanilla
- Deploy via Render

---

## 🙋‍♀️ Desenvolvido por

**Franciele Melo**  
🌐 Vendedora Vivo Empresas, apaixonada por tecnologia, IA e organização.  
📧 francielemelovieira@gmail.com  
🔗 [linkedin.com/in/francielemelo](https://linkedin.com/in/francielemelo)

---

## ⚠️ Observações

- O `clientes.json` é sobrescrito a cada novo upload.
- O sistema está hospedado no Render e pode levar alguns segundos para carregar após inatividade.

---
