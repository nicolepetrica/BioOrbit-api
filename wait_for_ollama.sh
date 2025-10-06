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

echo "⬇️  Pulling llama3.2:1b..."
ollama pull llama3.2:1b

echo "⬇️  Pulling llama3.2:3b..."
ollama pull llama3.2:3b

echo "⬇️  Pulling all-minilm..."
ollama pull all-minilm

# echo "⬇️  Pulling gemma2:2b..."
# ollama pull gemma2:2b


echo "✅ Models ready.."

# Substitui o processo atual pelo ollama (mantém o container ativo)
wait $pid