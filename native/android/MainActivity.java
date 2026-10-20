package org.jesuitas.ojesuitasoueu;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Collections;

public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final int CAMERA_REQUEST = 41;
    private static final int PHOTO_REQUEST = 42;
    private WebView web;
    private PermissionRequest cameraRequest;
    private ValueCallback<Uri[]> photoCallback;

    private boolean trusted(Uri uri) { return "https".equals(uri.getScheme()) && HOST.equals(uri.getHost()); }

    private WebResourceResponse missing() {
        return new WebResourceResponse("text/plain","UTF-8",404,"Not found",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));
    }

    private WebResourceResponse asset(Uri uri) {
        if (!trusted(uri)) return missing();
        String path = uri.getPath();
        if (path == null || !path.startsWith("/assets/") || path.contains("..") || path.contains("\\")) return missing();
        String file = path.substring("/assets/".length());
        if (file.length() == 0) file = "index.html";
        String type = "application/octet-stream";
        if (file.endsWith(".html")) type = "text/html";
        else if (file.endsWith(".js")) type = "text/javascript";
        else if (file.endsWith(".css")) type = "text/css";
        else if (file.endsWith(".json") || file.endsWith(".webmanifest")) type = "application/json";
        else if (file.endsWith(".svg")) type = "image/svg+xml";
        else if (file.endsWith(".png")) type = "image/png";
        else if (file.endsWith(".jpg") || file.endsWith(".jpeg")) type = "image/jpeg";
        else if (file.endsWith(".txt")) type = "text/plain";
        try {
            return new WebResourceResponse(type,"UTF-8",200,"OK",Collections.singletonMap("X-Content-Type-Options","nosniff"),getAssets().open("web/"+file));
        } catch (IOException exception) { return missing(); }
    }

    public class NativeBridge {
        @JavascriptInterface public boolean bundledAssetsAvailable() { return true; }
    }

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        getWindow().setStatusBarColor(0xff263d32);
        web = new WebView(this);
        web.setBackgroundColor(0xfff7f4ed);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        // The system photo picker grants access only to the selected content URI.
        web.getSettings().setAllowContentAccess(true);
        web.getSettings().setMediaPlaybackRequiresUserGesture(false);
        web.addJavascriptInterface(new NativeBridge(),"JesuitaNative");
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) { return asset(request.getUrl()); }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (trusted(uri)) return false;
                if ("https".equals(uri.getScheme()) || "http".equals(uri.getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW,uri)); } catch (ActivityNotFoundException ignored) { }
                }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> {
                    if (!trusted(request.getOrigin())) { request.deny(); return; }
                    boolean video = false;
                    for (String resource : request.getResources()) if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) video = true;
                    if (!video) { request.deny(); return; }
                    if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                        request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                    } else {
                        if (cameraRequest != null) cameraRequest.deny();
                        cameraRequest = request;
                        requestPermissions(new String[]{Manifest.permission.CAMERA},CAMERA_REQUEST);
                    }
                });
            }
            @Override public void onPermissionRequestCanceled(PermissionRequest request) { if (cameraRequest == request) cameraRequest = null; }
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (photoCallback != null) photoCallback.onReceiveValue(null);
                photoCallback = callback;
                Intent picker = new Intent(Intent.ACTION_GET_CONTENT);
                picker.addCategory(Intent.CATEGORY_OPENABLE); picker.setType("image/*");
                try { startActivityForResult(Intent.createChooser(picker,"Escolher fotografia"),PHOTO_REQUEST); }
                catch (ActivityNotFoundException error) { photoCallback.onReceiveValue(null); photoCallback = null; }
                return true;
            }
        });
        setContentView(web);
        web.loadUrl("https://"+HOST+"/assets/index.html");
    }

    @Override public void onRequestPermissionsResult(int requestCode,String[] permissions,int[] results) {
        super.onRequestPermissionsResult(requestCode,permissions,results);
        if (requestCode == CAMERA_REQUEST && cameraRequest != null) {
            if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED && trusted(cameraRequest.getOrigin())) cameraRequest.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
            else cameraRequest.deny();
            cameraRequest = null;
        }
    }
    @Override protected void onActivityResult(int requestCode,int resultCode,Intent intent) {
        super.onActivityResult(requestCode,resultCode,intent);
        if (requestCode == PHOTO_REQUEST && photoCallback != null) {
            photoCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode,intent)); photoCallback = null;
        }
    }
    @Override protected void onPause() {
        if (web != null && photoCallback == null && cameraRequest == null) web.evaluateJavascript("window.dispatchEvent(new Event('jesuita-native-pause'));",null);
        if (web != null) web.onPause();
        super.onPause();
    }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @Override public void onBackPressed() { if (web != null && web.canGoBack()) web.goBack(); else super.onBackPressed(); }
    @Override protected void onDestroy() {
        if (cameraRequest != null) cameraRequest.deny();
        if (photoCallback != null) photoCallback.onReceiveValue(null);
        if (web != null) { web.removeJavascriptInterface("JesuitaNative"); web.destroy(); }
        super.onDestroy();
    }
}
