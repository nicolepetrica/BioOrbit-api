FROM ollama/ollama

RUN apt-get update && apt-get install -y curl jq bash && rm -rf /var/lib/apt/lists/*

COPY ./wait_for_ollama.sh /wait_for_ollama.sh
RUN chmod +x /wait_for_ollama.sh

EXPOSE 11434
ENTRYPOINT ["/bin/bash", "/wait_for_ollama.sh"]