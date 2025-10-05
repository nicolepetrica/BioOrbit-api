from rag.rag import RAG
import time

if __name__ == "__main__":
    rag = RAG()

    prompt = input(">")

    # Then in main.py use regular for loop:
    # for chunk in rag.prompt_stream(prompt):
    #     print(chunk, end='', flush=True)

    start = time.time()
    response = rag.prompt(prompt)
    print(12*"=")
    print(12*"=")
    print(12*"=")
    print(response)
    print(f"TIME - {time.time() - start:.2f}s")