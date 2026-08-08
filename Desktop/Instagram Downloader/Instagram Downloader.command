#!/bin/bash
# ============================================================
#  Instagram Downloader — descargador de videos de Instagram
#  Doble clic para abrir. Pega el link y presiona Enter.
# ============================================================

cd "$(dirname "$0")" || exit 1

DEST="$HOME/Downloads"
COOKIES_BROWSER=""   # se detecta abajo si el usuario lo activa

# ---------- colores ----------
BOLD=$'\033[1m'; DIM=$'\033[2m'; RESET=$'\033[0m'
ROSA=$'\033[38;5;205m'; AZUL=$'\033[38;5;39m'; VERDE=$'\033[38;5;42m'
ROJO=$'\033[38;5;203m'; AMAR=$'\033[38;5;220m'

# ---------- localizar yt-dlp ----------
find_ytdlp() {
  for c in \
    "$(command -v yt-dlp 2>/dev/null)" \
    /opt/homebrew/bin/yt-dlp \
    /usr/local/bin/yt-dlp \
    /Library/Frameworks/Python.framework/Versions/*/bin/yt-dlp \
    "$HOME/Library/Python/"*/bin/yt-dlp
  do
    [ -n "$c" ] && [ -x "$c" ] && { echo "$c"; return 0; }
  done
  return 1
}

YTDLP="$(find_ytdlp)"
if [ -z "$YTDLP" ]; then
  printf '%s\n' "${ROJO}No se encontró yt-dlp.${RESET}"
  printf '%s\n' "Instálalo con:  ${BOLD}brew install yt-dlp${RESET}"
  printf '\n%s' "Presiona Enter para cerrar..."; read -r _; exit 1
fi

FFMPEG="$(command -v ffmpeg 2>/dev/null || echo /opt/homebrew/bin/ffmpeg)"

banner() {
  clear
  printf '%s\n' "${ROSA}${BOLD}"
  printf '%s\n' "  ╭──────────────────────────────────────────────╮"
  printf '%s\n' "  │        INSTAGRAM  DOWNLOADER                 │"
  printf '%s\n' "  ╰──────────────────────────────────────────────╯"
  printf '%s\n' "${RESET}"
  printf '%s\n' "  ${DIM}Guarda en:${RESET} ${AZUL}$DEST${RESET}"
  if [ -n "$COOKIES_BROWSER" ]; then
    printf '%s\n' "  ${DIM}Sesión:${RESET}    ${VERDE}cookies de $COOKIES_BROWSER${RESET}"
  fi
  printf '%s\n' ""
  printf '%s\n' "  ${DIM}Pega el link del reel/video y presiona Enter.${RESET}"
  printf '%s\n' "  ${DIM}Comandos:${RESET} ${BOLD}audio${RESET} ${DIM}·${RESET} ${BOLD}login${RESET} ${DIM}·${RESET} ${BOLD}carpeta${RESET} ${DIM}·${RESET} ${BOLD}salir${RESET}"
  printf '%s\n' ""
}

# ---------- normalizar / validar url ----------
clean_url() {
  local u="$1"
  u="${u#"${u%%[![:space:]]*}"}"        # trim izquierda
  u="${u%"${u##*[![:space:]]}"}"        # trim derecha
  u="${u%\"}"; u="${u#\"}"              # quitar comillas
  u="${u%\'}"; u="${u#\'}"
  u="${u%%\?*}"                          # quitar parámetros de tracking
  printf '%s' "$u"
}

is_instagram() {
  case "$1" in
    http://www.instagram.com/*|https://www.instagram.com/*) return 0 ;;
    http://instagram.com/*|https://instagram.com/*)         return 0 ;;
    https://*.instagram.com/*)                              return 0 ;;
    *) return 1 ;;
  esac
}

# ---------- descarga ----------
download() {
  local url="$1" modo="$2"
  local -a args=(
    --no-playlist-reverse
    --newline
    --no-warnings
    --restrict-filenames
    --no-mtime
    --retries 5
    --fragment-retries 5
    --concurrent-fragments 4
    --ffmpeg-location "$FFMPEG"
    --paths "$DEST"
    --output "%(uploader,id)s_%(id)s.%(ext)s"
  )

  if [ "$modo" = "audio" ]; then
    args+=( --extract-audio --audio-format mp3 --audio-quality 0 )
  else
    args+=( --format "bestvideo*+bestaudio/best" --merge-output-format mp4 )
  fi

  [ -n "$COOKIES_BROWSER" ] && args+=( --cookies-from-browser "$COOKIES_BROWSER" )

  printf '%s\n' "${AZUL}▸ Descargando...${RESET}"
  printf '%s\n' ""

  if "$YTDLP" "${args[@]}" -- "$url"; then
    printf '\n%s\n' "${VERDE}${BOLD}✓ Listo.${RESET} ${DIM}Guardado en $DEST${RESET}"
    return 0
  fi

  printf '\n%s\n' "${ROJO}✗ No se pudo descargar.${RESET}"
  if [ -z "$COOKIES_BROWSER" ]; then
    printf '%s\n' "${AMAR}  Si el post es privado o Instagram pide iniciar sesión,${RESET}"
    printf '%s\n' "${AMAR}  escribe ${BOLD}login${RESET}${AMAR} para usar la sesión de tu navegador.${RESET}"
  fi
  return 1
}

# ---------- activar cookies del navegador ----------
setup_login() {
  printf '%s\n' ""
  printf '%s\n' "  ${BOLD}Usar la sesión de tu navegador${RESET}"
  printf '%s\n' "  ${DIM}Debes tener Instagram abierto y con sesión iniciada.${RESET}"
  printf '%s\n' ""
  printf '%s\n' "   1) Chrome"
  printf '%s\n' "   2) Safari"
  printf '%s\n' "   3) Firefox"
  printf '%s\n' "   4) Edge"
  printf '%s\n' "   5) Brave"
  printf '%s\n' "   0) Desactivar"
  printf '%s'   "  Opción: "
  read -r op
  case "$op" in
    1) COOKIES_BROWSER="chrome"  ;;
    2) COOKIES_BROWSER="safari"  ;;
    3) COOKIES_BROWSER="firefox" ;;
    4) COOKIES_BROWSER="edge"    ;;
    5) COOKIES_BROWSER="brave"   ;;
    0) COOKIES_BROWSER=""        ;;
    *) printf '%s\n' "  ${ROJO}Opción inválida.${RESET}"; sleep 1; return ;;
  esac
  banner
}

# ---------- loop principal ----------
banner

while true; do
  printf '%s' "  ${ROSA}${BOLD}link ›${RESET} "
  if ! read -r entrada; then break; fi

  entrada="$(clean_url "$entrada")"

  case "$entrada" in
    ""|" ") continue ;;
    salir|exit|quit|q) break ;;
    login) setup_login; continue ;;
    carpeta|folder) open "$DEST"; printf '%s\n\n' "  ${DIM}Abriendo Downloads...${RESET}"; continue ;;
    limpiar|clear|cls) banner; continue ;;
    audio)
      printf '%s' "  ${AMAR}link del audio ›${RESET} "
      read -r u; u="$(clean_url "$u")"
      if is_instagram "$u"; then download "$u" audio; else
        printf '%s\n' "  ${ROJO}Ese no es un link de Instagram.${RESET}"; fi
      printf '%s\n' ""; continue ;;
  esac

  if is_instagram "$entrada"; then
    download "$entrada" video
  else
    printf '%s\n' "  ${ROJO}Ese no parece un link de Instagram.${RESET}"
    printf '%s\n' "  ${DIM}Ejemplo: https://www.instagram.com/reel/ABC123/${RESET}"
  fi
  printf '%s\n' ""
done

printf '\n%s\n' "  ${ROSA}Hasta luego 👋${RESET}"
sleep 0.4
