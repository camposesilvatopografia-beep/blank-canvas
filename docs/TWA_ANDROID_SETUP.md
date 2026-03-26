# 📱 ApropriAPP - Guia de Criação do App Android (TWA)

Este guia explica como transformar o ApropriAPP em um aplicativo Android nativo usando **Trusted Web Activity (TWA)**.

## 🎯 O que é TWA?

Trusted Web Activity permite empacotar seu PWA como um app Android nativo que:
- Roda em **tela cheia** (sem barra de endereço do navegador)
- Pode ser publicado na **Google Play Store**
- Mantém todas as funcionalidades do app web
- Atualiza automaticamente quando o site é atualizado

---

## 📋 Pré-requisitos

- **Android Studio** instalado ([download](https://developer.android.com/studio))
- **Java JDK 11+** instalado
- Conta de desenvolvedor na **Google Play Console** (para publicação)
- Acesso ao servidor para configurar o arquivo `assetlinks.json`

---

## 📦 Ícones Disponíveis

O projeto já possui ícones otimizados para Android:

| Tamanho | Arquivo | Uso |
|---------|---------|-----|
| 192x192 | `/icon-192.png` | Ícone padrão do app |
| 512x512 | `/icon-512.png` | Ícone de alta resolução / Play Store |

---

## 🎬 Splash Screen

O app já inclui uma **splash screen animada** que é exibida automaticamente quando:
- O app é aberto como TWA (modo standalone)
- É a primeira abertura da sessão

A splash screen possui:
- Logo animado com efeito de pulsação
- Barra de progresso
- Transição suave para a tela de login

---

## 🚀 Passo a Passo

### 1. Criar Projeto Android com Bubblewrap

```bash
# Instalar Bubblewrap
npm install -g @nicholasbraun/pwa2apk

# Navegar para pasta de trabalho
mkdir apropriapp-android && cd apropriapp-android

# Inicializar projeto TWA
npx bubblewrap init --manifest https://apropriapp.lovable.app/manifest.json
```

**Configure as opções quando solicitado:**

| Campo | Valor |
|-------|-------|
| **Domain** | `apropriapp.lovable.app` |
| **Start URL** | `/mobile/auth` |
| **App Name** | `ApropriAPP` |
| **Short Name** | `ApropriAPP` |
| **Package Name** | `app.lovable.apropriapp` |
| **Display Mode** | `standalone` |
| **Status Bar Color** | `#2d3e50` |
| **Navigation Bar Color** | `#2d3e50` |
| **Theme Color** | `#f59e0b` |
| **Background Color** | `#2d3e50` |

### 3. Gerar Keystore (para assinatura do APK)

```bash
# Gerar keystore (GUARDE A SENHA!)
keytool -genkeypair -v -keystore apropriapp.keystore -alias apropriapp -keyalg RSA -keysize 2048 -validity 10000

# Extrair SHA256 fingerprint (IMPORTANTE!)
keytool -list -v -keystore apropriapp.keystore -alias apropriapp | grep SHA256
```

**⚠️ IMPORTANTE:** Anote o SHA256 fingerprint, você precisará dele para o `assetlinks.json`.

### 4. Configurar assetlinks.json

O arquivo `assetlinks.json` já está em: `public/.well-known/assetlinks.json`

**Edite o arquivo e substitua `SUBSTITUA_PELA_SUA_FINGERPRINT_SHA256` pela sua fingerprint:**

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "app.lovable.apropriapp",
      "sha256_cert_fingerprints": [
        "XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX"
      ]
    }
  }
]
```

**Verificar se está acessível:**
```
https://apropriapp.lovable.app/.well-known/assetlinks.json
```

### 5. Gerar APK/AAB

```bash
# Build do APK (para testes)
npx bubblewrap build

# Build do AAB (para Play Store)
npx bubblewrap build --bundleOutput
```

Os arquivos serão gerados em:
- `app-release-signed.apk` (para testes)
- `app-release-bundle.aab` (para Play Store)

---

## 📱 Usando PWABuilder (Alternativa Mais Fácil)

Se preferir uma interface visual:

1. Acesse [PWABuilder.com](https://www.pwabuilder.com/)
2. Cole a URL: `https://apropriapp.lovable.app`
3. Clique em **Start**
4. Selecione **Android** → **Google Play**
5. Configure:
   - **Package ID**: `app.lovable.apropriapp`
   - **App Name**: `ApropriAPP`
   - **Start URL**: `/mobile/auth`
   - **Display Mode**: `standalone`
   - **Status Bar Color**: `#2d3e50`
   - **Theme Color**: `#f59e0b`
6. Baixe o projeto Android
7. Abra no Android Studio para compilar

---

## 🧪 Testando Localmente

### Método 1: Dispositivo Android Físico

```bash
# Conectar dispositivo via USB (ativar Depuração USB)
adb devices

# Instalar APK
adb install app-release-signed.apk
```

### Método 2: Emulador Android Studio

1. Abra o Android Studio
2. Vá em **Tools → Device Manager**
3. Crie um dispositivo virtual (AVD) com Android 10+
4. Arraste o APK para o emulador

### Verificar Digital Asset Links

```bash
# Testar se assetlinks.json está configurado corretamente
adb shell am start -a android.intent.action.VIEW -d "https://apropriapp.lovable.app/.well-known/assetlinks.json"
```

---

## 🏪 Publicar na Google Play Store

### 1. Criar Conta de Desenvolvedor

1. Acesse [Google Play Console](https://play.google.com/console)
2. Pague a taxa única de $25
3. Complete o perfil de desenvolvedor

### 2. Criar App

1. Clique em **Criar app**
2. Preencha:
   - **Nome do app**: ApropriAPP
   - **Idioma padrão**: Português (Brasil)
   - **Tipo**: App
   - **Gratuito ou Pago**: Gratuito

### 3. Configurar Listagem

- **Descrição curta**: Sistema de gestão de operações para frota e equipamentos
- **Descrição completa**: ApropriAPP é um sistema completo de gestão de operações...
- **Capturas de tela**: Adicione screenshots do app
- **Ícone**: Use o favicon.png em 512x512px

### 4. Upload do AAB

1. Vá em **Produção → Criar nova versão**
2. Faça upload do arquivo `.aab`
3. Adicione notas da versão
4. Revise e publique

---

## 🔄 Atualização da URL Inicial

Para mudar a URL inicial do app:

### Se usando Bubblewrap:
```bash
# Editar twa-manifest.json
nano twa-manifest.json

# Alterar startUrl
"startUrl": "/mobile/auth"

# Rebuild
npx bubblewrap build
```

### Se usando PWABuilder:
1. Baixe novo pacote com a URL atualizada
2. Gere novo AAB
3. Publique como atualização na Play Store

---

## 📊 URLs de Referência

| Recurso | URL |
|---------|-----|
| **App Publicado** | https://apropriapp.lovable.app |
| **Login Mobile** | https://apropriapp.lovable.app/mobile/auth |
| **Instalação PWA** | https://apropriapp.lovable.app/install |
| **Manifest** | https://apropriapp.lovable.app/manifest.json |
| **Asset Links** | https://apropriapp.lovable.app/.well-known/assetlinks.json |

---

## ❓ Solução de Problemas

### Barra de endereço aparece no app
- Verifique se o `assetlinks.json` está correto e acessível
- Confirme se a fingerprint SHA256 está correta
- Limpe o cache do Chrome no dispositivo

### App não abre em tela cheia
- O Digital Asset Links pode levar até 48h para propagar
- Teste com: `adb shell am start -a android.intent.action.VIEW -d "https://apropriapp.lovable.app"`

### Erro de certificado
- Certifique-se de usar o mesmo keystore para todas as builds
- A fingerprint no assetlinks.json deve corresponder exatamente

---

## 📞 Suporte

Para dúvidas sobre a implementação, entre em contato com o administrador do sistema.

**Última atualização:** Janeiro 2026
