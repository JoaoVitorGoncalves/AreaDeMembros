FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine

COPY --from=build /app/dist/million-dash/browser /usr/share/nginx/html
COPY --from=build /app/ngsw-config.json /usr/share/nginx/html/ngsw-config.json

COPY <<'EOF' /etc/nginx/conf.d/default.conf
server {
    listen       80;
    server_name  localhost;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 1000;

    root   /usr/share/nginx/html;
    index  index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(?:ico|css|js|gif|jpe?g|png|woff2?|eot|ttf|svg|webp|avif|mp4|webm)$ {
        expires 6M;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    location ~* \.(?:json|xml)$ {
        expires 1d;
        add_header Cache-Control "public";
    }

    location = /ngsw.json {
        add_header Cache-Control "no-cache";
    }

    location = /ngsw-worker.js {
        add_header Cache-Control "no-cache";
    }

    location = /index.html {
        add_header Cache-Control "no-cache";
    }
}
EOF

RUN chmod -R 755 /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
