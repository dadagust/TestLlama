from flask import Flask, jsonify, request
from flask_cors import CORS
from llama_cpp import Llama
import threading
import sqlite3
import datetime

app = Flask(__name__)
CORS(app)

llm = None
model_path = "model/llama.gguf"
db_path = "chat.db"


def init_db():
	conn = sqlite3.connect(db_path)
	cursor = conn.cursor()
	cursor.execute('''
        CREATE TABLE IF NOT EXISTS conversation (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender TEXT NOT NULL,
            message TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
	conn.commit()
	conn.close()


def load_model():
	global llm
	try:
		llm = Llama(model_path=model_path, n_ctx=2048, n_gpu_layers=0)
		print("Модель Llama успешно загружена.")
	except Exception as e:
		print(f"Ошибка при загрузке модели: {e}")


@app.route('/start-llama', methods=['POST'])
def start_llama():
	if llm:
		return jsonify({"status": "Модель уже загружена."})

	thread = threading.Thread(target=load_model)
	thread.start()

	return jsonify({"status": "Загрузка модели запущена..."})


@app.route('/history', methods=['GET'])
def get_history():
	conn = sqlite3.connect(db_path)
	conn.row_factory = sqlite3.Row
	cursor = conn.cursor()
	cursor.execute("SELECT sender, message FROM conversation ORDER BY timestamp ASC")
	history = [dict(row) for row in cursor.fetchall()]
	conn.close()
	return jsonify(history)


@app.route('/clear-history', methods=['POST'])
def clear_history():
	conn = sqlite3.connect(db_path)
	cursor = conn.cursor()
	cursor.execute("DELETE FROM conversation")
	conn.commit()
	conn.close()
	return jsonify({"status": "История чата очищена."})


@app.route('/chat', methods=['POST'])
def chat():
	if not llm:
		return jsonify({"error": "Модель не загружена."}), 400

	user_message = request.json.get("message")
	if not user_message:
		return jsonify({"error": "Сообщение не может быть пустым."}), 400

	conn = sqlite3.connect(db_path)
	cursor = conn.cursor()
	cursor.execute("INSERT INTO conversation (sender, message) VALUES (?, ?)", ("user", user_message))
	conn.commit()

	cursor.execute("SELECT sender, message FROM conversation ORDER BY timestamp ASC")
	history = cursor.fetchall()

	context = "\n".join([f"{'User' if sender == 'user' else 'AI'}: {msg}" for sender, msg in history])
	full_prompt = f"{context}\nAI:"

	try:
		output = llm(full_prompt, max_tokens=250, stop=["\n", "User:", "AI:"], echo=False)
		ai_response = output['choices'][0]['text'].strip()
	except Exception as e:
		conn.close()
		return jsonify({"error": str(e)}), 500

	cursor.execute("INSERT INTO conversation (sender, message) VALUES (?, ?)", ("ai", ai_response))
	conn.commit()
	conn.close()

	return get_history()


if __name__ == '__main__':
	init_db()
	app.run(port=5000, debug=True)