import os
import sqlite3
import threading

import whisper
from TTS.api import TTS
from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
from llama_cpp import Llama

app = Flask(__name__)
CORS(app)

# --- Глобальные переменные и пути ---
llm = None
whisper_model = None
tts_model = None
model_path = "model/llama.gguf"
db_path = "chat.db"
INPUT_AUDIO_DIR = "audio_input"
OUTPUT_AUDIO_DIR = "audio_output"


# --- Инициализация моделей ---
def load_models():
	global llm, whisper_model, tts_model
	try:
		print("Загрузка модели Llama...")
		llm = Llama(model_path=model_path, n_ctx=2048, n_gpu_layers=0, verbose=False)
		print("Модель Llama успешно загружена.")

		print("Загрузка модели Whisper (STT)...")
		whisper_model = whisper.load_model("base")
		print("Модель Whisper успешно загружена.")

		print("Загрузка АНГЛИЙСКОЙ модели TTS...")
		# Используем стандартную английскую модель, которая стабильно работает
		tts_model = TTS(model_name="tts_models/en/ljspeech/tacotron2-DDC", progress_bar=True, gpu=False)
		print("Модель TTS успешно загружена.")

	except Exception as e:
		print(f"Критическая ошибка при загрузке моделей: {e}")


# --- Инициализация БД (без изменений) ---
def init_db():
	conn = sqlite3.connect(db_path)
	cursor = conn.cursor()
	cursor.execute('''
        CREATE TABLE IF NOT EXISTS conversation (
            id INTEGER PRIMARY KEY AUTOINCREMENT, sender TEXT, message TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
	conn.commit()
	conn.close()


# --- Логика Llama с английским системным промптом ---
def get_llama_response(user_message):
	if not llm:
		return "Llama model is not loaded yet."

	conn = sqlite3.connect(db_path)
	cursor = conn.cursor()
	cursor.execute("INSERT INTO conversation (sender, message) VALUES (?, ?)", ("user", user_message))
	conn.commit()

	cursor.execute("SELECT sender, message FROM conversation ORDER BY timestamp ASC")
	history = cursor.fetchall()
	conn.close()

	context_history = "\n".join([f"{'User' if sender == 'user' else 'AI'}: {msg}" for sender, msg in history])
	system_prompt = "You are a helpful AI assistant. Please respond in English."
	full_prompt = f"{system_prompt}\n\n{context_history}\nAI:"

	output = llm(full_prompt, max_tokens=250, stop=["\n", "User:", "AI:"], echo=False)
	ai_response = output['choices'][0]['text'].strip()

	conn = sqlite3.connect(db_path)
	cursor = conn.cursor()
	cursor.execute("INSERT INTO conversation (sender, message) VALUES (?, ?)", ("ai", ai_response))
	conn.commit()
	conn.close()

	return ai_response


@app.route('/status', methods=['GET'])
def get_status():
	status = {
		"llama": "Загружена" if llm else "Не загружена",
		"whisper": "Загружена" if whisper_model else "Не загружена",
		"tts": "Загружена" if tts_model else "Не загружена",
	}
	return jsonify(status)


@app.route('/start-models', methods=['POST'])
def start_models():
	if not llm and not whisper_model and not tts_model:
		threading.Thread(target=load_models).start()
		return jsonify({"status": "Загрузка всех моделей запущена..."})
	return jsonify({"status": "Модели уже загружаются или загружены."})


@app.route('/history', methods=['GET'])

# --- ГОЛОСОВОЙ ЧАТ (полностью на английском) ---
@app.route('/voice-chat', methods=['POST'])
def voice_chat():
	if 'audio' not in request.files:
		return jsonify({"error": "Audio file not found"}), 400

	if not all([llm, whisper_model, tts_model]):
		return jsonify({"error": "One or more models are not loaded"}), 503

	audio_file = request.files['audio']
	input_path = os.path.join(INPUT_AUDIO_DIR, "user_audio.wav")
	audio_file.save(input_path)

	print("Транскрибирование аудио (EN)...")
	transcription_result = whisper_model.transcribe(input_path, language="en", fp16=False)
	user_text = transcription_result['text']
	print(f"Распознано: {user_text}")

	print("Генерация ответа Llama...")
	ai_text_response = get_llama_response(user_text)
	print(f"Ответ Llama: {ai_text_response}")

	print("Синтез речи (EN)...")
	output_path = os.path.join(OUTPUT_AUDIO_DIR, "response.wav")
	tts_model.tts_to_file(text=ai_text_response, file_path=output_path)
	print("Речь синтезирована.")

	return send_file(output_path, mimetype='audio/wav')


# --- Код для текстового чата (без изменений) ---
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
	user_message = request.json.get("message")
	ai_response = get_llama_response(user_message)
	return get_history()


if __name__ == '__main__':
	os.makedirs(INPUT_AUDIO_DIR, exist_ok=True)
	os.makedirs(OUTPUT_AUDIO_DIR, exist_ok=True)
	init_db()
	app.run(port=5000, debug=True, use_reloader=False)
