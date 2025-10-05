#!/bin/bash
# Inicia o Ollama em background
echo "🕐 Starting Ollama server..."
ollama serve &
pid=$!

# Espera o servidor ficar pronto
echo "🕐 Waiting for Ollama to be ready..."
sleep 5

# Faz o pull dos modelos necessários
echo "🔴 Retrieving models..."
echo "⬇️  Pulling nomic-embed-text..."
ollama pull nomic-embed-text

echo "⬇️  Pulling qwen2.5:0.5b..."
ollama pull qwen2.5:0.5b

echo "⬇️  Pulling gemma2:2b..."
ollama pull gemma2:2b


echo "✅ Models ready.."

# Substitui o processo atual pelo ollama (mantém o container ativo)
wait $pid