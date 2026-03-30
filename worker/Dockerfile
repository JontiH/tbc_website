FROM node:22-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN npm install -g wrangler
COPY . .
RUN chmod +x entrypoint.sh
EXPOSE 8787
CMD ["sh", "entrypoint.sh"]
