# 📸 Condições para Fotografia

Aplicação React + Vite para ajudar fotógrafos a determinar as melhores condições meteorológicas para fotografia de paisagem, especialmente para nascer e pôr do sol com espelhagem.

## 🚀 Tecnologias

- **React 19** - Framework frontend
- **Vite** - Build tool e dev server
- **Tailwind CSS v4** - Estilização
- **Axios** - Cliente HTTP
- **Vercel Serverless Functions** - API routes

## 📋 Funcionalidades

- 🔍 Busca de cidades em Portugal
- 🌤️ Previsão meteorológica detalhada (5 dias)
- 📊 Análise específica para fotografia:
  - Condições de nuvens (tipo, altura, cobertura)
  - Direção e velocidade do vento
  - Horários de Golden Hour e Blue Hour
  - Posição do sol (azimute e elevação)
  - Condições atmosféricas (humidade, pressão, neblina)
  - Qualidade da água para espelhagem
  - Índices de dispersão de luz e contraste
  - Sugestões de equipamento (lentes, tripé, filtros)

## 🛠️ Instalação

```bash
# Instalar dependências
npm install

# Desenvolvimento
npm run dev

# Build para produção
npm run build

# Preview do build
npm run preview
```

## ⚙️ Configuração

### Variáveis de Ambiente

**IMPORTANTE:** Configure a variável de ambiente no Vercel:

1. Acesse o [Vercel Dashboard](https://vercel.com/dashboard)
2. Selecione o projeto
3. Vá em **Settings → Environment Variables**
4. Adicione:
   - **Name:** `OPENWEATHER_API_KEY`
   - **Value:** sua chave do OpenWeatherMap
   - **Environment:** Production, Preview e Development
5. Clique em **Save**
6. Faça um novo deploy

Para desenvolvimento local, crie um arquivo `.env.local`:

```
OPENWEATHER_API_KEY=sua_chave_aqui
```

Obtenha uma chave gratuita em: https://openweathermap.org/api

## 📦 Deploy

O projeto está configurado para deploy no Vercel:

1. Conecte o repositório GitHub ao Vercel
2. Configure a variável de ambiente `OPENWEATHER_API_KEY`
3. O Vercel detectará automaticamente o projeto React + Vite

## 📁 Estrutura do Projeto

```
cloudai/
├── api/                    # Vercel Serverless Functions
│   ├── cities/
│   │   └── search.js      # Busca de cidades
│   └── weather/
│       └── [city].js       # Previsão do tempo
├── src/
│   ├── components/         # Componentes React
│   │   ├── App.jsx
│   │   ├── CitySearch.jsx
│   │   └── WeatherCard.jsx
│   ├── index.css          # Estilos globais (Tailwind)
│   └── main.jsx           # Entry point
├── index.html             # HTML principal
├── vite.config.js        # Configuração Vite
├── vercel.json           # Configuração Vercel
└── package.json          # Dependências
```

## 📝 Licença

MIT
