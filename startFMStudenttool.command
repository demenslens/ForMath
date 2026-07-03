#!/bin/bash
# startStudenttool.command — start ForMath Studenttool (werkblad) en opent browser

PROJECT_DIR="$HOME/Desktop/formath/studenttool"
PORT=8000
URL="http://localhost:$PORT/werkblad/werkblad.html"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "================================================================"
echo "  ForMath Studenttool (werkblad) — startup"
echo "================================================================"
echo ""

if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}FOUT: project-map niet gevonden:${NC}"
    echo "  $PROJECT_DIR"
    echo ""
    read -p "Druk Enter om dit venster te sluiten..."
    exit 1
fi

if [ ! -f "$PROJECT_DIR/werkblad/werkblad.html" ]; then
    echo -e "${RED}FOUT: werkblad.html niet gevonden:${NC}"
    echo "  $PROJECT_DIR/werkblad/werkblad.html"
    echo ""
    read -p "Druk Enter om dit venster te sluiten..."
    exit 1
fi

if [ ! -d "$PROJECT_DIR/testopgaven" ]; then
    echo -e "${YELLOW}LET OP: map 'testopgaven' niet gevonden naast 'werkblad'.${NC}"
    echo "  Verwacht: $PROJECT_DIR/testopgaven"
    echo "  De studenttool laadt dan geen opgaven."
    echo ""
fi

EXISTING_PID=$(lsof -ti tcp:$PORT 2>/dev/null)
if [ -n "$EXISTING_PID" ]; then
    echo -e "${YELLOW}Er draait al iets op poort $PORT (PID $EXISTING_PID).${NC}"
    echo ""
    echo "  1) Bestaande server gebruiken — open alleen de browser"
    echo "  2) Bestaande server stoppen en opnieuw starten"
    echo "  3) Afbreken"
    echo ""
    read -p "Keuze [1/2/3]: " keuze
    case "$keuze" in
        1)
            open "$URL"
            read -p "Druk Enter om dit venster te sluiten..."
            exit 0
            ;;
        2)
            kill "$EXISTING_PID" 2>/dev/null
            sleep 1
            if kill -0 "$EXISTING_PID" 2>/dev/null; then
                kill -9 "$EXISTING_PID" 2>/dev/null
                sleep 1
            fi
            echo "Oude server gestopt."
            ;;
        *)
            exit 0
            ;;
    esac
fi

echo -e "${GREEN}Server starten...${NC}"
echo "  map:    $PROJECT_DIR"
echo "  poort:  $PORT"
echo ""

# Server draait vanuit de studenttool-map, zodat ../testopgaven/ klopt
# (het werkblad zoekt opgaven relatief vanuit werkblad/).
cd "$PROJECT_DIR" || exit 1

python3 -m http.server "$PORT" &
SERVER_PID=$!

echo "Wacht tot server klaar is..."
for i in {1..20}; do
    sleep 0.3
    if lsof -ti tcp:$PORT >/dev/null 2>&1; then
        break
    fi
done

if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo -e "${RED}FOUT: server gestopt vlak na starten.${NC}"
    read -p "Druk Enter om dit venster te sluiten..."
    exit 1
fi

echo -e "${GREEN}Server is klaar.${NC}"
echo "  URL: $URL"
echo ""

open "$URL"

echo "================================================================"
echo "  Server draait. Logs verschijnen hieronder."
echo "  Stoppen: Ctrl+C, of sluit dit venster."
echo "================================================================"
echo ""

wait "$SERVER_PID"

echo ""
echo "Server gestopt."
read -p "Druk Enter om dit venster te sluiten..."
