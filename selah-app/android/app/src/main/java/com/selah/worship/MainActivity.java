package com.selah.worship;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

import org.json.JSONArray;

public class MainActivity extends BridgeActivity {
    private static final String CHANNEL_ID = "selah_default";
    private static final int NOTIF_PERMISSION_CODE = 1001;
    private int notifIdCounter = 1;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createNotificationChannel();

        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebView wv = this.bridge.getWebView();
            wv.addJavascriptInterface(new AndroidPrintInterface(), "AndroidPrint");
            wv.addJavascriptInterface(new AndroidNotifyInterface(), "AndroidNotify");
            wv.addJavascriptInterface(new AndroidHapticInterface(), "AndroidHaptic");
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Selah Notifications",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            channel.setDescription("Worship setlist and team notifications");
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }

    // ── Print Bridge ──
    public class AndroidPrintInterface {
        @JavascriptInterface
        public void print() {
            runOnUiThread(() -> {
                WebView webView = bridge.getWebView();
                if (webView != null) {
                    PrintManager pm = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                    PrintDocumentAdapter adapter = webView.createPrintDocumentAdapter("Selah_Worship_Setlist");
                    if (pm != null) {
                        pm.print("Selah Worship Setlist", adapter, new PrintAttributes.Builder().build());
                    }
                }
            });
        }
    }

    // ── Notification Bridge ──
    public class AndroidNotifyInterface {
        @JavascriptInterface
        public String requestPermission() {
            if (Build.VERSION.SDK_INT >= 33) {
                if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.POST_NOTIFICATIONS)
                        == PackageManager.PERMISSION_GRANTED) {
                    return "granted";
                }
                ActivityCompat.requestPermissions(MainActivity.this,
                    new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIF_PERMISSION_CODE);
                // Return pending — JS should re-check after a moment
                return "pending";
            }
            return "granted"; // Pre-Android 13 doesn't need runtime permission
        }

        @JavascriptInterface
        public boolean isGranted() {
            if (Build.VERSION.SDK_INT >= 33) {
                return ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.POST_NOTIFICATIONS)
                        == PackageManager.PERMISSION_GRANTED;
            }
            return true;
        }

        @JavascriptInterface
        public void show(String title, String body) {
            NotificationCompat.Builder builder = new NotificationCompat.Builder(MainActivity.this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setAutoCancel(true);

            NotificationManagerCompat nm = NotificationManagerCompat.from(MainActivity.this);
            if (ActivityCompat.checkSelfPermission(MainActivity.this, Manifest.permission.POST_NOTIFICATIONS)
                    == PackageManager.PERMISSION_GRANTED || Build.VERSION.SDK_INT < 33) {
                nm.notify(notifIdCounter++, builder.build());
            }
        }
    }

    // ── Haptic Bridge ──
    public class AndroidHapticInterface {
        @JavascriptInterface
        public void vibrate(String patternJson) {
            try {
                JSONArray arr = new JSONArray(patternJson);
                long[] pattern = new long[arr.length() + 1];
                pattern[0] = 0; // no initial delay
                for (int i = 0; i < arr.length(); i++) {
                    pattern[i + 1] = arr.getLong(i);
                }

                Vibrator v;
                if (Build.VERSION.SDK_INT >= 31) {
                    VibratorManager vm = (VibratorManager) getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                    v = vm != null ? vm.getDefaultVibrator() : null;
                } else {
                    v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
                }

                if (v != null && v.hasVibrator()) {
                    if (Build.VERSION.SDK_INT >= 26) {
                        v.vibrate(VibrationEffect.createWaveform(pattern, -1));
                    } else {
                        v.vibrate(pattern, -1);
                    }
                }
            } catch (Exception e) {
                // Silent fail
            }
        }
    }
}
