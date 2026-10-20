package main

import (
	"bytes"
	"context"
	"embed"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

//go:embed all:web
var bundled embed.FS

//go:embed desktop-host.js
var clientScript []byte

var version = "0.6.0"
const product = "O jesuíta sou eu"

func main() {
	port := flag.Int("port", 63365, "Local application port")
	noOpen := flag.Bool("no-open", false, "Run the local service without opening a window")
	flag.Parse()
	address := fmt.Sprintf("127.0.0.1:%d", *port)
	listener, err := net.Listen("tcp4", address)
	if err != nil {
		client := http.Client{Timeout: time.Second}
		response, requestErr := client.Get("http://" + address + "/_native/health")
		if requestErr == nil {
			defer response.Body.Close()
			var status map[string]string
			if json.NewDecoder(response.Body).Decode(&status) == nil && status["application"] == product {
				if status["version"] != version { showError("Fecha a versão anterior da aplicação antes de abrir esta atualização."); return }
				if !*noOpen { if err := openWindow("http://" + address + "/"); err != nil { showError(err.Error()) } }
				return
			}
		}
		showError("Não foi possível iniciar a aplicação. Fecha uma instância anterior e tenta novamente.")
		return
	}
	defer listener.Close()
	address = listener.Addr().String()
	web, _ := fs.Sub(bundled, "web")
	server := &http.Server{ReadHeaderTimeout: 5*time.Second, IdleTimeout: 30*time.Second}
	var clientsMu sync.Mutex
	clients := make(map[string]time.Time)
	started := time.Now()
	var closeTimer *time.Timer
	server.Handler = appHandler(web, address, func(request *http.Request) {
		body, _ := io.ReadAll(io.LimitReader(request.Body, 100))
		id := strings.TrimSpace(string(body))
		if id == "" { return }
		clientsMu.Lock()
		defer clientsMu.Unlock()
		if closeTimer != nil { closeTimer.Stop() }
		if request.URL.Path == "/_native/close" {
			delete(clients, id)
			if len(clients) == 0 { closeTimer = time.AfterFunc(3*time.Second, func(){ _ = server.Shutdown(context.Background()) }) }
		} else { clients[id] = time.Now() }
	})
	go func() {
		ticker := time.NewTicker(30*time.Second); defer ticker.Stop()
		for range ticker.C {
			clientsMu.Lock()
			for id, seen := range clients { if time.Since(seen) > 10*time.Minute { delete(clients, id) } }
			idle := len(clients) == 0 && time.Since(started) > 2*time.Minute
			clientsMu.Unlock()
			if idle { _ = server.Shutdown(context.Background()); return }
		}
	}()
	if !*noOpen {
		if err := openWindow("http://" + address + "/"); err != nil { showError(err.Error()); return }
	}
	log.Printf("%s %s — http://%s/", product, version, address)
	if err := server.Serve(listener); err != nil && err != http.ErrServerClosed { showError(err.Error()) }
}

func appHandler(web fs.FS, host string, heartbeat func(*http.Request)) http.Handler {
	files := http.FileServer(http.FS(web))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Host != host { http.Error(w, "Invalid host", http.StatusForbidden); return }
		w.Header().Set("X-Content-Type-Options", "nosniff")
		if strings.HasPrefix(r.URL.Path, "/_native/") {
			w.Header().Set("Cache-Control", "no-store")
			switch r.URL.Path {
			case "/_native/health":
				if r.Method != http.MethodGet { w.WriteHeader(http.StatusMethodNotAllowed); return }
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(map[string]string{"application": product, "version": version})
			case "/_native/client.js":
				if r.Method != http.MethodGet { w.WriteHeader(http.StatusMethodNotAllowed); return }
				w.Header().Set("Content-Type", "text/javascript; charset=utf-8"); _, _ = w.Write(clientScript)
			case "/_native/ping", "/_native/close":
				if r.Method != http.MethodPost || r.Header.Get("Origin") != "http://"+host { w.WriteHeader(http.StatusForbidden); return }
				heartbeat(r); w.WriteHeader(http.StatusNoContent)
			default: http.NotFound(w,r)
			}
			return
		}
		if r.Method != http.MethodGet && r.Method != http.MethodHead { w.WriteHeader(http.StatusMethodNotAllowed); return }
		if r.URL.Path == "/" || r.URL.Path == "/index.html" {
			data, err := fs.ReadFile(web, "index.html"); if err != nil { http.Error(w,"Missing application",500); return }
			data = bytes.Replace(data, []byte("</head>"), []byte(`<script>window.JESUITA_BUNDLED_ASSETS=true;</script><script src="./_native/client.js" defer></script></head>`), 1)
			w.Header().Set("Content-Type", "text/html; charset=utf-8"); w.Header().Set("Cache-Control", "no-store")
			if r.Method != http.MethodHead { _, _ = w.Write(data) }; return
		}
		files.ServeHTTP(w,r)
	})
}
