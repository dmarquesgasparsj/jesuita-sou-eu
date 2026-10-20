package main

import (
	"bytes"
	"encoding/json"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestBundledApplication(t *testing.T) {
	web, _ := fs.Sub(bundled,"web")
	host := "127.0.0.1:63365"
	handler := appHandler(web,host,func(*http.Request){})
	var manifest struct { Assets []string `json:"assets"` }
	data, _ := fs.ReadFile(web,"offline-assets.json")
	if err := json.Unmarshal(data,&manifest); err != nil { t.Fatal(err) }
	for _, asset := range manifest.Assets {
		if asset == "index.html" { continue }
		r := httptest.NewRequest("GET","http://"+host+"/"+asset,nil)
		w := httptest.NewRecorder(); handler.ServeHTTP(w,r)
		expected, err := fs.ReadFile(web,asset)
		if err != nil || w.Code != 200 || !bytes.Equal(w.Body.Bytes(),expected) { t.Fatalf("Bundled resource unavailable: %s",asset) }
	}
	r := httptest.NewRequest("GET","http://"+host+"/",nil); w := httptest.NewRecorder(); handler.ServeHTTP(w,r)
	if w.Code != 200 || !bytes.Contains(w.Body.Bytes(),[]byte("JESUITA_BUNDLED_ASSETS=true")) { t.Fatal("Bundled app startup flag missing") }
	badHost := httptest.NewRequest("GET","http://untrusted.example/",nil); blocked := httptest.NewRecorder(); handler.ServeHTTP(blocked,badHost)
	if blocked.Code != 403 { t.Fatal("Unexpected host must be rejected") }
	for _, origin := range []string{"https://untrusted.example",""} {
		r := httptest.NewRequest("POST","http://"+host+"/_native/close",bytes.NewBufferString("test")); r.Header.Set("Origin",origin)
		w := httptest.NewRecorder(); handler.ServeHTTP(w,r)
		if w.Code != 403 { t.Fatal("Other sites must not control the local application") }
	}
}
