#!/bin/sh
set -e

echo "🚀 Iniciando build..."
echo "📂 Diretório atual: $(pwd)"
echo "📋 Listando arquivos:"
ls -la

# Instalar Composer se não estiver disponível
if ! command -v composer &> /dev/null; then
    echo "📦 Instalando Composer..."
    curl -sS https://getcomposer.org/installer | php || {
        echo "❌ Erro ao baixar Composer, tentando método alternativo..."
        php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');"
        php composer-setup.php
        rm composer-setup.php
    }
    COMPOSER_CMD="php composer.phar"
else
    echo "✅ Composer encontrado"
    COMPOSER_CMD="composer"
fi

# Instalar dependências PHP
echo "📦 Instalando dependências PHP..."
$COMPOSER_CMD install --no-dev --optimize-autoloader --no-interaction --prefer-dist

# Instalar dependências Node.js
echo "📦 Instalando dependências Node.js..."
npm install

# Build dos assets
echo "🔨 Compilando assets..."
npm run build

# Criar diretório dist e copiar arquivos
echo "📁 Criando diretório dist..."
mkdir -p dist

# Copiar estrutura do Laravel
echo "📋 Copiando arquivos..."
cp -r public dist/public || true
cp -r app dist/app || true
cp -r bootstrap dist/bootstrap || true
cp -r config dist/config || true
cp -r database dist/database || true
cp -r resources dist/resources || true
cp -r routes dist/routes || true
cp -r storage dist/storage || true
cp -r vendor dist/vendor || true
cp artisan dist/ || true
cp composer.json dist/ || true
cp composer.lock dist/ || true

# Criar arquivo de marcação
touch dist/.vercel

# Verificar se dist foi criado corretamente
echo "📋 Verificando diretório dist..."
ls -la dist/ || echo "❌ Erro: diretório dist não foi criado!"
ls -la dist/public/ || echo "❌ Erro: dist/public não foi criado!"

echo "✅ Build concluído!"
