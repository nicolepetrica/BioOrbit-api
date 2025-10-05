FROM ollama/ollama

COPY ./wait_for_ollama.sh /wait_for_ollama.sh
RUN chmod +x /wait_for_ollama.sh

EXPOSE 11434
ENTRYPOINT ["/bin/bash", "/wait_for_ollama.sh"]