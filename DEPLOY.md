# Guia de Deploy

## ⚠️ Vercel não é recomendado para Laravel

O Vercel é otimizado para aplicações serverless (Node.js/Next.js) e não suporta bem Laravel porque:
- Não tem PHP disponível no ambiente de build
- Requer configurações complexas
- Performance limitada para aplicações PHP tradicionais

## ✅ Plataformas Recomendadas para Laravel

### 1. Railway (Recomendado) ⭐
- **URL**: https://railway.app
- **Vantagens**: 
  - Suporte nativo para Laravel
  - Deploy automático via Git
  - Grátis para começar
  - Muito fácil de configurar

**Como fazer deploy:**
1. Crie conta no Railway
2. Conecte seu repositório GitHub
3. Railway detecta automaticamente Laravel
4. Configure variáveis de ambiente (`.env`)
5. Deploy automático!

### 2. Laravel Forge
- **URL**: https://forge.laravel.com
- **Vantagens**:
  - Feito especificamente para Laravel
  - Gerenciamento completo de servidores
  - Deploy automático via Git
  - Suporte oficial

### 3. DigitalOcean App Platform
- **URL**: https://www.digitalocean.com/products/app-platform
- **Vantagens**:
  - Bom suporte para PHP/Laravel
  - Escalável
  - Deploy via Git

### 4. Heroku
- **URL**: https://www.heroku.com
- **Vantagens**:
  - Suporte para Laravel
  - Deploy via Git
  - Add-ons disponíveis

## 🚀 Deploy Rápido no Railway

1. Acesse https://railway.app
2. Faça login com GitHub
3. Clique em "New Project" → "Deploy from GitHub repo"
4. Selecione o repositório `xavierNabais/cloudAI`
5. Railway detecta Laravel automaticamente
6. Configure as variáveis de ambiente:
   - `APP_KEY` (gere com `php artisan key:generate`)
   - `OPENWEATHERMAP_KEY` (sua chave da API)
   - `APP_ENV=production`
   - `APP_DEBUG=false`
7. Railway faz o deploy automaticamente!

## 📝 Variáveis de Ambiente Necessárias

```env
APP_NAME=CloudAI
APP_ENV=production
APP_KEY=base64:... (gere com php artisan key:generate)
APP_DEBUG=false
APP_URL=https://seu-dominio.com

OPENWEATHERMAP_KEY=sua-chave-aqui
```

## 🔧 Comandos Úteis

```bash
# Gerar APP_KEY
php artisan key:generate

# Limpar cache
php artisan config:clear
php artisan cache:clear
php artisan route:clear
php artisan view:clear
```
