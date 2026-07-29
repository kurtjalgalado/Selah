package com.selah.worship;

import android.content.Context;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Register Android native printing interface for WebView
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().addJavascriptInterface(new AndroidPrintInterface(), "AndroidPrint");
        }
    }

    public class AndroidPrintInterface {
        @JavascriptInterface
        public void print() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    WebView webView = bridge.getWebView();
                    if (webView != null) {
                        PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                        PrintDocumentAdapter printAdapter = webView.createPrintDocumentAdapter("Selah_Worship_Setlist");
                        String jobName = "Selah Worship Setlist";
                        if (printManager != null) {
                            printManager.print(jobName, printAdapter, new PrintAttributes.Builder().build());
                        }
                    }
                }
            });
        }
    }
}
