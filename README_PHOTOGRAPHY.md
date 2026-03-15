# 📸 App de Condições Meteorológicas para Fotografia

Aplicação web para ajudar fotógrafos a avaliar as melhores condições meteorológicas para fotografia de paisagem, especialmente para pôr e nascer do sol com espelhagem.

## 🚀 Funcionalidades

- **Previsão meteorológica** para qualquer cidade
- **Avaliação automática** das condições para fotografia baseada em:
  - Cobertura de nuvens (ideal: 20-40% para fotos dramáticas)
  - Velocidade do vento (importante para espelhagem)
  - Visibilidade
  - Condições meteorológicas gerais
- **Busca de cidades** com autocompletar
- **Previsão de 3, 5 ou 7 dias**
- **Horários de nascer e pôr do sol**
- **Notas personalizadas** sobre condições ideais para fotografia

## 📋 Requisitos

- PHP 8.2+
- Composer
- Node.js e npm
- Chave da API OpenWeatherMap (gratuita em [openweathermap.org](https://openweathermap.org/api))

## 🔧 Instalação

1. **Clone o repositório** (se aplicável)

2. **Instale as dependências PHP:**
   ```bash
   composer install
   ```

3. **Instale as dependências Node:**
   ```bash
   npm install
   ```

4. **Configure o arquivo .env:**
   ```bash
   cp .env.example .env
   php artisan key:generate
   ```

5. **Adicione a chave da API OpenWeatherMap no .env:**
   ```env
   OPENWEATHER_API_KEY=sua_chave_aqui
   ```

   Para obter uma chave gratuita:
   - Acesse [openweathermap.org](https://openweathermap.org/api)
   - Crie uma conta gratuita
   - Gere uma API key no painel

6. **Execute as migrações** (se necessário):
   ```bash
   php artisan migrate
   ```

7. **Compile os assets:**
   ```bash
   npm run build
   ```

## 🏃 Executar a Aplicação

**Desenvolvimento:**
```bash
# Terminal 1 - Laravel
php artisan serve

# Terminal 2 - Vite (frontend)
npm run dev
```

Acesse: `http://localhost:8000`

**Produção:**
```bash
npm run build
php artisan serve
```

## 📁 Estrutura do Projeto

```
cloudai/
├── app/
│   ├── Http/Controllers/Api/
│   │   ├── WeatherController.php    # API de previsão do tempo
│   │   └── CityController.php       # API de busca de cidades
│   └── Services/
│       └── WeatherService.php        # Lógica de integração com OpenWeatherMap
├── resources/
│   ├── js/
│   │   ├── app.jsx                   # Entry point React
│   │   └── components/
│   │       ├── App.jsx               # Componente principal
│   │       ├── CitySearch.jsx        # Busca de cidades
│   │       └── WeatherCard.jsx       # Card de previsão
│   └── views/
│       └── welcome.blade.php         # View principal
└── routes/
    └── api.php                       # Rotas da API
```

## 🎯 Como Funciona

1. **Busca de Cidades:** Usa a API de Geocoding do OpenWeatherMap para buscar cidades
2. **Previsão do Tempo:** Obtém previsão de 3 horas para os próximos dias
3. **Avaliação para Fotografia:** Analisa múltiplos fatores:
   - **Nuvens:** 20-40% é ideal para fotos dramáticas de pôr/nascer do sol
   - **Vento:** Baixo vento (< 3 m/s) é melhor para espelhagem
   - **Visibilidade:** Quanto maior, melhor
   - **Condições:** Evita chuva, considera névoa
4. **Status:** Classifica como "Excelente", "Bom", "Razoável" ou "Mau"

## 🔑 Variáveis de Ambiente

```env
OPENWEATHER_API_KEY=sua_chave_da_api_openweathermap
```

## 📝 Notas

- A API do OpenWeatherMap tem limites de requisições no plano gratuito (60 chamadas/minuto)
- Os dados são cacheados por 30 minutos para otimizar performance
- O cálculo de nascer/pôr do sol é aproximado baseado em latitude/longitude

## 🛠️ Tecnologias

- **Backend:** Laravel 12
- **Frontend:** React 18 + Vite
- **Styling:** Tailwind CSS 4
- **API Externa:** OpenWeatherMap

## 📄 Licença

Este projeto é de uso pessoal/educacional.
