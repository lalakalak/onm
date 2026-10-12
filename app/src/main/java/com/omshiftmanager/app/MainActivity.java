package com.omshiftmanager.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {
    private static final int REQUEST_CREATE_EXPORT = 4101;
    private static final int REQUEST_IMPORT_JSON = 4102;
    private WebView webView;
    private String pendingExport = "";
    private String pendingExportName = "om-shift-manager-export.json";
    private String pendingMime = "application/json";
    private ValueCallback<Uri[]> fileChooserCallback;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        setContentView(webView);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(false);
        webView.getSettings().setDatabaseEnabled(false);
        webView.addJavascriptInterface(new AndroidStorage(), "AndroidStorage");
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false;
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileChooserCallback != null) fileChooserCallback.onReceiveValue(null);
                fileChooserCallback = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                try { startActivityForResult(intent, REQUEST_IMPORT_JSON); }
                catch (Exception e) { fileChooserCallback = null; callback.onReceiveValue(null); }
                return true;
            }
        });
        webView.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> {
            Toast.makeText(this, "Use the app's download buttons to save files.", Toast.LENGTH_SHORT).show();
        });
        webView.loadUrl("file:///android_asset/www/index.html");
    }

    private File jsonFile() { return new File(getFilesDir(), "om-shift-manager-data.json"); }

    public class AndroidStorage {
        @JavascriptInterface public boolean hasDataFile() { return jsonFile().exists() && jsonFile().length() > 0; }
        @JavascriptInterface public String readJson() {
            try (FileInputStream in = new FileInputStream(jsonFile()); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[8192]; int n;
                while ((n = in.read(buffer)) > 0) out.write(buffer, 0, n);
                return out.toString("UTF-8");
            } catch (Exception e) { return ""; }
        }
        @JavascriptInterface public boolean writeJson(String content) {
            try {
                File temp = new File(getFilesDir(), "om-shift-manager-data.tmp");
                try (FileOutputStream out = new FileOutputStream(temp)) { out.write(content.getBytes(StandardCharsets.UTF_8)); out.flush(); out.getFD().sync(); }
                File target = jsonFile();
                if (target.exists() && !target.delete()) return false;
                return temp.renameTo(target);
            } catch (Exception e) { return false; }
        }
        @JavascriptInterface public void exportJson(String content, String filename) { beginExport(content, filename, "application/json"); }
        @JavascriptInterface public void saveDownload(String dataUrl, String filename, String mimeType) {
            try {
                int comma = dataUrl.indexOf(',');
                String payload = comma >= 0 ? dataUrl.substring(comma + 1) : dataUrl;
                byte[] bytes = Base64.decode(payload, Base64.DEFAULT);
                pendingExport = Base64.encodeToString(bytes, Base64.NO_WRAP);
                pendingExportName = filename == null ? "roster-download" : filename;
                pendingMime = mimeType == null ? "application/octet-stream" : mimeType;
                runOnUiThread(() -> {
                    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType(pendingMime);
                    intent.putExtra(Intent.EXTRA_TITLE, pendingExportName);
                    startActivityForResult(intent, REQUEST_CREATE_EXPORT);
                });
            } catch (Exception e) { runOnUiThread(() -> Toast.makeText(MainActivity.this, "Could not prepare download", Toast.LENGTH_LONG).show()); }
        }
    }

    private void beginExport(String content, String filename, String mime) {
        pendingExport = Base64.encodeToString(content.getBytes(StandardCharsets.UTF_8), Base64.NO_WRAP);
        pendingExportName = filename;
        pendingMime = mime;
        runOnUiThread(() -> {
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType(pendingMime);
            intent.putExtra(Intent.EXTRA_TITLE, pendingExportName);
            startActivityForResult(intent, REQUEST_CREATE_EXPORT);
        });
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_IMPORT_JSON) {
            if (fileChooserCallback != null) {
                Uri[] result = resultCode == RESULT_OK && data != null && data.getData() != null ? new Uri[]{data.getData()} : null;
                fileChooserCallback.onReceiveValue(result);
                fileChooserCallback = null;
            }
            return;
        }
        if (requestCode == REQUEST_CREATE_EXPORT && resultCode == RESULT_OK && data != null && data.getData() != null) {
            try (java.io.OutputStream out = getContentResolver().openOutputStream(data.getData())) {
                if (out == null) throw new IllegalStateException("No output stream");
                out.write(Base64.decode(pendingExport, Base64.DEFAULT)); out.flush();
                Toast.makeText(this, "File saved successfully", Toast.LENGTH_LONG).show();
            } catch (Exception e) { Toast.makeText(this, "Could not save file: " + e.getMessage(), Toast.LENGTH_LONG).show(); }
        }
    }

    @Override public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack(); else super.onBackPressed();
    }
}
