#!/bin/sh

set -e

echo "Starting Ollama..."

ollama serve &

PID=$!

echo "Waiting for Ollama API..."

until curl -sf http://127.0.0.1:11434/api/tags >/dev/null
do
    sleep 2
done

echo "Ollama is ready."

echo "Checking llama3.2:3b..."
if ! ollama list | grep -q "^llama3.2:3b"; then
    echo "Downloading llama3.2:3b..."
    ollama pull llama3.2:3b
else
    echo "✓ llama3.2:3b already installed."
fi

echo "Checking nomic-embed-text..."
if ! ollama list | grep -q "^nomic-embed-text"; then
    echo "Downloading nomic-embed-text..."
    ollama pull nomic-embed-text
else
    echo "✓ nomic-embed-text already installed."
fi

echo "All models are ready."

wait $PID