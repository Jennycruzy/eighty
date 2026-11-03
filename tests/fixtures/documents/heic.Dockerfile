FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends libheif-examples && rm -rf /var/lib/apt/lists/*
ENTRYPOINT ["heif-enc"]
