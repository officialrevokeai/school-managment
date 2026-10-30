package com.schoolmanagement.mobile;

import java.net.URI;
import java.net.InetAddress;
import java.util.Locale;

/** URL policy is deliberately independent of Android so it is JVM-testable. */
public final class ServerPolicy {
    public static final String DEFAULT_ORIGIN = "https://school-management-system.bot-keep.xyz";
    private ServerPolicy() {}
    public static String normalize(String input) {
        try {
            URI uri = new URI(input.trim());
            String host = uri.getHost();
            if (!"https".equalsIgnoreCase(uri.getScheme()) || host == null || uri.getRawUserInfo() != null
                    || uri.getRawQuery() != null || uri.getRawFragment() != null
                    || !(uri.getRawPath() == null || uri.getRawPath().isEmpty() || "/".equals(uri.getRawPath()))) throw new IllegalArgumentException();
            host = host.toLowerCase(Locale.ROOT);
            String bare = host.replace("[", "").replace("]", "");
            if(bare.endsWith("."))bare=bare.substring(0,bare.length()-1);
            if(bare.contains(":")){if(bare.contains("%"))throw new IllegalArgumentException();InetAddress literal=InetAddress.getByName(bare);if(literal.isLoopbackAddress()||literal.isAnyLocalAddress())throw new IllegalArgumentException();}
            if (bare.equals("localhost") || bare.endsWith(".localhost") || bare.startsWith("127.")
                    || bare.equals("::1") || bare.equals("0.0.0.0") || bare.equals("10.0.2.2")
                    || bare.startsWith("::ffff:") || uri.getPort() == 0 || uri.getPort() > 65535) throw new IllegalArgumentException();
            return new URI("https", null, host, uri.getPort() == 443 ? -1 : uri.getPort(), null, null, null).toASCIIString();
        } catch (Exception e) {
            throw new IllegalArgumentException("Enter your school's HTTPS server address, for example https://school.example.com. Localhost and HTTP addresses cannot connect shared phones.");
        }
    }
    public static boolean sameOrigin(String origin, String target) {
        try {
            URI a = new URI(normalize(origin)), b = new URI(target);
            return "https".equalsIgnoreCase(b.getScheme()) && b.getRawUserInfo() == null && b.getHost() != null
                    && a.getHost().equalsIgnoreCase(b.getHost()) && port(a) == port(b);
        } catch (Exception e) { return false; }
    }
    private static int port(URI uri) { return uri.getPort() == -1 ? 443 : uri.getPort(); }
    public static String filename(String input, String fallback) {
        String clean = input == null ? "" : input.replaceAll("[^a-zA-Z0-9._ -]", "_");
        if (clean.isEmpty() || clean.equals(".") || clean.equals("..")) clean = fallback;
        return clean.length() > 120 ? clean.substring(clean.length() - 120) : clean;
    }
}
