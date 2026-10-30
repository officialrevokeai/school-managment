package com.schoolmanagement.mobile;

public final class ServerPolicyTest {
    private static int checks;
    private static void yes(boolean condition){checks++;if(!condition)throw new AssertionError("URL policy assertion "+checks);}
    private static void rejected(String input){try{ServerPolicy.normalize(input);throw new AssertionError("Accepted unsafe server: "+input);}catch(IllegalArgumentException expected){checks++;}}
    public static void main(String[] args){
        yes(ServerPolicy.normalize(ServerPolicy.DEFAULT_ORIGIN).equals("https://school-management-system.bot-keep.xyz"));
        yes(ServerPolicy.normalize(" https://School.Example.com/ ").equals("https://school.example.com"));
        yes(ServerPolicy.normalize("https://school.example.com:443").equals("https://school.example.com"));
        yes(ServerPolicy.normalize("https://school.example.com:8443").equals("https://school.example.com:8443"));
        rejected("https://[0:0:0:0:0:0:0:1]");rejected("https://localhost.");rejected("https://[::]");
        for(String input:new String[]{"http://school.example.com","javascript:alert(1)","file:///private","https://localhost","https://school.localhost","https://127.0.0.1","https://[::1]","https://0.0.0.0","https://10.0.2.2","https://user:pass@school.example.com","https://school.example.com/#/signin","https://school.example.com?token=secret","https://school.example.com/path","https://school.example.com:0","https://school.example.com:99999",""})rejected(input);
        yes(ServerPolicy.sameOrigin("https://school.example.com","https://school.example.com/api/v1/reports/export?kind=counts"));
        yes(ServerPolicy.sameOrigin("https://school.example.com:443","https://SCHOOL.example.com/#/signin"));
        for(String url:new String[]{"https://school.example.com.evil.test/file","https://school.example.com@evil.test/file","http://school.example.com/file","https://school.example.com:8443/file","blob:https://school.example.com/file","content://private/file","https://user@school.example.com/file"})yes(!ServerPolicy.sameOrigin("https://school.example.com",url));
        yes(!ServerPolicy.filename("../../private\nname.csv","export.csv").contains("/"));
        yes(ServerPolicy.filename("..","export.csv").equals("export.csv"));
        yes(ServerPolicy.filename(new String(new char[200]).replace('\0','x'),"export.csv").length()==120);
        System.out.println("Android server/download URL policy: "+checks+" checks passed.");
    }
}
