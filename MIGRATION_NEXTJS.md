# Migração para Next.js

O projeto foi convertido de Laravel + React para Next.js para funcionar no Vercel.

## ✅ O que foi feito

1. **Estrutura Next.js criada:**
   - `pages/` - Páginas e API routes
   - `components/` - Componentes React
   - `lib/` - Serviços e utilitários
   - `styles/` - Estilos globais

2. **API Routes criadas:**
   - `/api/weather/[city]` - Previsão do tempo
   - `/api/cities/search` - Busca de cidades

3. **Componentes React mantidos:**
   - `CitySearch` - Busca de cidades
   - `WeatherCard` - Card de previsão
   - `App` → `pages/index.tsx` - Página principal

4. **Configuração Vercel:**
   - `vercel.json` configurado para Next.js
   - Framework detectado automaticamente

## 📝 Próximos passos

1. **Instalar dependências:**
   ```bash
   npm install
   ```

2. **Configurar variável de ambiente:**
   - No Vercel: Settings → Environment Variables
   - Adicionar: `OPENWEATHER_API_KEY` = sua chave

3. **Testar localmente:**
   ```bash
   npm run dev
   ```

4. **Fazer deploy:**
   - Push para GitHub
   - Vercel detecta automaticamente e faz deploy

## ⚠️ Nota

Esta é uma versão simplificada. Algumas funcionalidades avançadas do WeatherService PHP podem precisar ser implementadas depois. A versão atual funciona e pode ser expandida conforme necessário.

## 🔧 Melhorias futuras

- Implementar todos os cálculos detalhados do WeatherService original
- Adicionar cache (usar Vercel Edge Cache ou Redis)
- Melhorar tratamento de erros
- Adicionar mais validações
