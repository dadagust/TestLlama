import threading

from flask import Flask, jsonify, request
from flask_cors import CORS
from llama_cpp import Llama

app = Flask(__name__)
CORS(app)

llm = None
model_path = "model/llama.gguf"


def load_model():
	global llm
	try:
		llm = Llama(model_path=model_path, n_ctx=512, n_gpu_layers=0)  # n_gpu_layers=0 для запуска на CPU
		print("Модель успешно загружена.")
	except Exception as e:
		print(f"Ошибка при загрузке модели: {e}")


@app.route('/start-llama', methods=['POST'])
def start_llama():
	if llm:
		return jsonify({"status": "Модель уже загружена."})

	thread = threading.Thread(target=load_model)
	thread.start()

	return jsonify({"status": "Загрузка модели запущена."})


@app.route('/chat', methods=['POST'])
def chat():
	if not llm:
		return jsonify({"error": "Модель не загружена."}), 400

	prompt = request.json.get("prompt")
	if not prompt:
		return jsonify({"error": "Запрос не может быть пустым."}), 400

	try:
		output = llm(prompt, max_tokens=150, stop=["\n"], echo=False)
		response = output['choices'][0]['text'].strip()
		return jsonify({"response": response})
	except Exception as e:
		return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
	app.run(port=5000, debug=True)
