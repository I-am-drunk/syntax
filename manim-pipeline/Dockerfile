FROM manimcommunity/manim:stable

USER root
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
RUN /opt/venv/bin/pip3 install --no-cache-dir --upgrade edge-tts MF-Tools
USER manimuser

WORKDIR /workspace
