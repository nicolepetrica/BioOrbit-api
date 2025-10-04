FROM ollama/ollama

# Copy the script to the docker image
COPY ./wait_for_ollama.sh /wait_for_ollama.sh

# Ensure the script is executable
RUN chmod +x /wait_for_ollama.sh

EXPOSE 11434
# ENV OLLAMA_CPU_MODE=true
ENTRYPOINT ["/bin/sh", "/wait_for_ollama.sh"]