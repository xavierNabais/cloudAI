#!/bin/bash
set -e

# Instalar Composer
curl -sS https://getcomposer.org/installer | php

# Instalar dependências PHP
php composer.phar install --no-dev --optimize-autoloader --no-interaction

# Instalar dependências Node.js
npm install

# Build dos assets
npm run build

# Criar diretório dist e copiar arquivos
mkdir -p dist
cp -r public dist/public
cp -r app bootstrap config database resources routes storage vendor dist/ 2>/dev/null || true
cp artisan composer.json composer.lock dist/ 2>/dev/null || true
touch dist/.vercel
