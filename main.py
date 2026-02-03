import os
import re
import json
import pandas as pd
import numpy as np
from flask import Flask, render_template, request, jsonify, session, redirect, url_for, send_from_directory
from werkzeug.utils import secure_filename
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY', 'telebrasil_secret_key_2025')
app.config['MAX_CONTENT_LENGTH'] = 32 * 1024 * 1024 

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DADOS_FOLDER = os.path.join(BASE_DIR, 'dados')
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
JSON_PATH = os.path.join(DADOS_FOLDER, 'clientes.json')

os.makedirs(DADOS_FOLDER, exist_ok=True)
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# POPULAR O DICIONÁRIO DE USUÁRIOS
usuarios = {}
for key, value in os.environ.items():
    if key.startswith("USER_"):
        user_clean = key.replace("USER_", "").lower()
        usuarios[user_clean] = value

def limpa_id(v):
    if pd.isna(v) or str(v).lower() in ['nan', 'null', '']: return ""
    num = re.sub(r"\D", "", str(v))
    return num.lstrip('0')

@app.route('/')
def index():
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if 'usuario' in session: return redirect(url_for('dashboard'))
    erro = None
    if request.method == 'POST':
        user = request.form.get('username', '').lower().strip()
        senha = request.form.get('password', '')
        if user in usuarios and usuarios[user] == senha:
            session.permanent = True
            session['usuario'] = user
            return redirect(url_for('dashboard'))
        erro = 'Usuário ou senha incorretos'
    return render_template('login.html', erro=erro)

@app.route('/dashboard')
def dashboard():
    if 'usuario' not in session: return redirect(url_for('login'))
    return render_template('dashboard.html', usuario=session['usuario'])

@app.route('/upload', methods=['POST'])
def upload():
    if 'usuario' not in session: return jsonify({"erro": "Não autorizado"}), 401
    file = request.files.get('file')
    if not file: return jsonify({"erro": "Nenhum arquivo"}), 400
    
    filename = secure_filename(file.filename)
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)
    
    try:
        # Detecta separador automaticamente para CSVs
        if filename.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(filepath, dtype=str)
        else:
            df = pd.read_csv(filepath, sep=None, engine='python', dtype=str, encoding='latin1')
        
        df.columns = [str(c).strip().upper() for c in df.columns]

        # MAPEAMENTO ATUALIZADO: Usando 'CONSULTORES' conforme seu CSV
        mapeamento = {
            'NM_CLIENTE': 'nome', 
            'NR_CNPJ': 'cnpj',
            'DS_ID_CIDADE': 'cidade',
            'DS_CIDADE': 'cidade',
            'SITUACAO_RECEITA': 'situacao', 
            'RECOMENDACAO': 'recomendacao', 
            'CELULAR_CONTATO_PRINCIPAL_SFA': 'telefone',
            'CONSULTORES': 'consultor', # <--- Alteração principal aqui
            'VENCIMENTO': 'vencimento',
            'DATA_FIM_VTECH': 'data_fim_vtech',
            'VIVO_TECH': 'vivo_tech',
            'M_MOVEL': 'm_movel', 
            'M_FIXA': 'm_fixa',
            'TP_PRODUTO': 'tp_produto',
            'QT_BASICA_TERM_METALICO': 'term_metalico',
            'DS_DISPONIBILIDADE': 'disponibilidade',
            'DDR': 'ddr',
            '0800': 'zero800',
            'SIP_VOZ': 'sip_voz',
            'VOX_DIGITAL': 'vox_digital',
            'CD_PESSOA': 'cd_pessoa'
        }

        df_json = df.rename(columns=mapeamento)
        
        colunas_final = [
            'nome', 'cnpj', 'cidade', 'consultor', 'situacao', 'recomendacao', 
            'telefone', 'm_movel', 'm_fixa', 'tp_produto', 
            'data_fim_vtech', 'vivo_tech', 'vencimento', 'term_metalico', 'disponibilidade',
            'ddr', 'zero800', 'sip_voz', 'vox_digital', 'cd_pessoa',
        ]

        # Garantir que todas as colunas existam
        for col in colunas_final:
            if col not in df_json.columns:
                df_json[col] = ""

        # Limpeza e conversão
        df_json['m_movel'] = pd.to_numeric(df_json['m_movel'], errors='coerce').fillna(0).astype(int)
        df_json['m_fixa'] = pd.to_numeric(df_json['m_fixa'], errors='coerce').fillna(0).astype(int)
        df_json['cnpj'] = df_json['cnpj'].apply(limpa_id)
        df_json['cd_pessoa'] = df_json['cd_pessoa'].apply(limpa_id)
        
        # Limpar espaços em branco nos nomes dos consultores para o filtro não falhar
        df_json['consultor'] = df_json['consultor'].str.strip()

        dados = df_json[colunas_final].fillna("").to_dict(orient='records')
        
        with open(JSON_PATH, 'w', encoding='utf-8') as f:
            json.dump(dados, f, ensure_ascii=False, indent=4)
            
        return jsonify({"mensagem": "Upload concluído!", "status": "ok"})
    except Exception as e:
        return jsonify({"erro": str(e)}), 500

# ROTA PARA ENVIAR A LISTA DE CONSULTORES PARA O FILTRO DO FRONTEND
@app.route('/api/filtros')
def get_filtros():
    try:
        if not os.path.exists(JSON_PATH):
            return jsonify({"consultores": []})
        with open(JSON_PATH, 'r', encoding='utf-8') as f:
            dados = json.load(f)
        
        # Extrai nomes únicos de consultores, remove vazios e ordena
        consultores = sorted(list(set(d['consultor'] for d in dados if d['consultor'])))
        return jsonify({"consultores": consultores})
    except Exception as e:
        return jsonify({"erro": str(e)}), 500

@app.route('/dados/clientes.json')
def dados_clientes():
    return send_from_directory(DADOS_FOLDER, 'clientes.json')

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5001))
    app.run(host='0.0.0.0', port=port)