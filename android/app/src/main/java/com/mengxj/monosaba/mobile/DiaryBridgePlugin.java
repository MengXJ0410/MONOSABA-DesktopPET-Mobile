package com.mengxj.monosaba.mobile;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/**
 * 日记 / 记忆原生桥。
 *
 * 连接器（魔女小屋钥匙）在本机 127.0.0.1 开一个随机端口，端口和 token 通过
 * signature 权限的 ContentProvider 交给这里。JS 层只拿到日记 JSON，不接触 token。
 */
@CapacitorPlugin(name = "DiaryBridge")
public class DiaryBridgePlugin extends Plugin {
    private static final String CONNECTOR_PACKAGE = "com.mengxj.monosaba.key";
    private static final Uri STATUS_URI =
            Uri.parse("content://com.mengxj.monosaba.key.status/status");
    private static final int CONNECT_TIMEOUT_MS = 4_000;
    private static final int READ_TIMEOUT_MS = 60_000;
    private static final int MEMORY_READ_TIMEOUT_MS = 120_000;

    @PluginMethod
    public void status(PluginCall call) {
        runInBackground(() -> {
            ConnectorStatus status = readStatus();
            JSObject result = new JSObject();
            result.put("installed", status.installed);
            result.put("connected", status.connected);
            result.put("state", status.state);
            result.put("remainingSeconds", status.remainingSeconds);
            result.put("expiresAt", status.expiresAt);
            if (status.error != null) result.put("error", status.error);
            resolve(call, result);
        });
    }

    @PluginMethod
    public void openConnector(PluginCall call) {
        runInBackground(() -> {
            JSObject result = new JSObject();
            Context context = getContext();
            Intent intent = context.getPackageManager().getLaunchIntentForPackage(CONNECTOR_PACKAGE);
            if (intent == null) {
                result.put("ok", false);
                result.put("error", "没有找到「魔女小屋钥匙」，请先安装。");
                resolve(call, result);
                return;
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try {
                context.startActivity(intent);
                result.put("ok", true);
            } catch (Exception error) {
                result.put("ok", false);
                result.put("error", "打不开钥匙：" + error.getMessage());
            }
            resolve(call, result);
        });
    }

    @PluginMethod
    public void loadDiary(PluginCall call) {
        final String book = call.getString("book");
        runInBackground(() -> {
            ConnectorStatus status = readStatus();
            if (!status.connected) {
                resolve(call, error(describeNotConnected(status)));
                return;
            }
            try {
                String path = "/diary";
                if (book != null && !book.isEmpty()) {
                    path += "?book=" + URLEncoder.encode(book, "UTF-8");
                }
                resolve(call, fetch(status, path));
            } catch (Exception error) {
                resolve(call, error(friendlyNetworkError(error)));
            }
        });
    }

    @PluginMethod
    public void loadMemory(PluginCall call) {
        runInBackground(() -> {
            ConnectorStatus status = readStatus();
            if (!status.connected) {
                resolve(call, error(describeNotConnected(status)));
                return;
            }
            try {
                resolve(call, fetch(status, "/memory", MEMORY_READ_TIMEOUT_MS));
            } catch (Exception error) {
                resolve(call, error(friendlyNetworkError(error)));
            }
        });
    }

    private JSObject fetch(ConnectorStatus status, String path) throws Exception {
        return fetch(status, path, READ_TIMEOUT_MS);
    }

    private JSObject fetch(ConnectorStatus status, String path, int readTimeoutMs) throws Exception {
        HttpURLConnection connection = null;
        try {
            URL url = new URL("http://127.0.0.1:" + status.port + path);
            connection = (HttpURLConnection) url.openConnection();
            connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
            connection.setReadTimeout(readTimeoutMs);
            connection.setRequestMethod("GET");
            connection.setRequestProperty("X-Connector-Token", status.token);
            connection.setRequestProperty("Accept", "application/json");

            int code = connection.getResponseCode();
            InputStream stream = code >= 200 && code < 300
                    ? connection.getInputStream()
                    : connection.getErrorStream();
            String body = readAll(stream);

            if (code == 401 || code == 403) {
                return error("钥匙拒绝了访问，请重新连接。");
            }
            if (body == null || body.isEmpty()) {
                return error("钥匙没有返回内容，请重试。");
            }

            JSONObject wrapper = new JSONObject(body);
            if (!wrapper.optBoolean("ok", false)) {
                return error(wrapper.optString("error", "钥匙读取失败。"));
            }
            JSONObject data = wrapper.optJSONObject("data");
            if (data == null) {
                return error("钥匙返回的数据不完整。");
            }
            JSObject result = new JSObject();
            result.put("ok", true);
            result.put("data", data.toString());
            return result;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private JSObject error(String message) {
        JSObject result = new JSObject();
        result.put("ok", false);
        result.put("error", message);
        return result;
    }

    private String describeNotConnected(ConnectorStatus status) {
        if (!status.installed) {
            return "没有找到「魔女小屋钥匙」，请先安装并连接服务器。";
        }
        if (status.error != null) return status.error;
        if (status.state.equals("expired")) {
            return "钥匙的连接已经到期，请重新打开钥匙连接。";
        }
        return "钥匙没有连接服务器，日记本还锁着。";
    }

    private String friendlyNetworkError(Exception error) {
        String message = error.getMessage() == null ? error.toString() : error.getMessage();
        if (message.contains("ECONNREFUSED") || message.contains("Connection refused")) {
            return "连不上钥匙，请确认它在后台运行。";
        }
        if (message.contains("timed out") || message.contains("timeout")) {
            return "钥匙响应超时，请重新连接后再试。";
        }
        return "读取失败：" + message;
    }

    private void runInBackground(Runnable task) {
        Thread thread = new Thread(task, "monosaba-diary-bridge");
        thread.setDaemon(true);
        thread.start();
    }

    private void resolve(PluginCall call, JSObject result) {
        Activity activity = getActivity();
        if (activity != null) {
            activity.runOnUiThread(() -> call.resolve(result));
        } else {
            call.resolve(result);
        }
    }

    private ConnectorStatus readStatus() {
        ConnectorStatus status = new ConnectorStatus();
        Context context = getContext();
        try (Cursor cursor = context.getContentResolver()
                .query(STATUS_URI, null, null, null, null)) {
            if (cursor == null || !cursor.moveToFirst()) return status;
            status.installed = true;
            int running = cursor.getInt(cursor.getColumnIndexOrThrow("running"));
            status.port = cursor.getInt(cursor.getColumnIndexOrThrow("port"));
            status.token = cursor.getString(cursor.getColumnIndexOrThrow("token"));
            status.expiresAt = cursor.getLong(cursor.getColumnIndexOrThrow("expiresAt"));
            status.remainingSeconds = cursor.getInt(cursor.getColumnIndexOrThrow("remainingSeconds"));
            String state = cursor.getString(cursor.getColumnIndexOrThrow("state"));
            status.state = state == null ? "idle" : state.toLowerCase(java.util.Locale.ROOT);

            boolean timeLeft = status.expiresAt > System.currentTimeMillis()
                    && status.remainingSeconds > 0;
            status.connected = running == 1 && timeLeft
                    && status.state.equals("connected")
                    && status.port > 0
                    && status.token != null
                    && !status.token.isEmpty();
            if (!status.connected && timeLeft && running == 0) {
                status.state = "idle";
            }
        } catch (SecurityException error) {
            status.installed = true;
            status.state = "forbidden";
            status.error = "签名不一致，日记通道被系统拒绝。请确认两个应用使用同一个签名。";
        } catch (IllegalArgumentException error) {
            status.state = "notInstalled";
        } catch (Exception error) {
            status.state = "unavailable";
            status.error = "读取连接状态失败：" + error.getMessage();
        }
        if (status.state == null) status.state = "notInstalled";
        if (status.remainingSeconds <= 0 && status.expiresAt > 0) {
            // 过期后不再显示负数。
            status.remainingSeconds = 0;
        }
        return status;
    }

    private static String readAll(InputStream stream) throws Exception {
        if (stream == null) return "";
        try (InputStream input = stream) {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            byte[] buffer = new byte[16 * 1024];
            int read;
            while ((read = input.read(buffer)) > 0) {
                output.write(buffer, 0, read);
            }
            return output.toString(StandardCharsets.UTF_8.name());
        }
    }

    private static final class ConnectorStatus {
        boolean installed;
        boolean connected;
        int port;
        String token;
        long expiresAt;
        int remainingSeconds;
        String state = "notInstalled";
        String error;
    }
}
