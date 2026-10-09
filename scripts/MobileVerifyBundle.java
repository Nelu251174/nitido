import java.nio.file.*;
import java.security.*;
import java.util.*;
import java.util.jar.*;
// Java source launcher works on the Java 21 CI JDK; no Maven dependency.
class MobileVerifyBundle {
  public static void main(String[] args) throws Exception {
    if(args.length != 2 || !args[1].matches("[a-fA-F0-9]{64}")) throw new IllegalArgumentException("Usage: AAB expected-existing-certificate-SHA256");
    int signed=0;
    try(JarFile jar = new JarFile(args[0], true)) {
      var entries=jar.entries(); var names=new HashSet<String>();
      while(entries.hasMoreElements()) {
        var e=entries.nextElement();
        if(!names.add(e.getName())) throw new SecurityException("Duplicate bundle entry");
        if(e.isDirectory() || e.getName().startsWith("META-INF/")) continue;
        try(var stream=jar.getInputStream(e)) { stream.transferTo(java.io.OutputStream.nullOutputStream()); }
        var signers=e.getCodeSigners();
        if(signers==null || signers.length!=1) throw new SecurityException("Unsigned or multiple signer bundle entry");
        var certificate=signers[0].getSignerCertPath().getCertificates().get(0);
        var digest=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(certificate.getEncoded()));
        if(!digest.equalsIgnoreCase(args[1])) throw new SecurityException("Existing upload certificate mismatch");
        if(certificate instanceof java.security.cert.X509Certificate x509) x509.checkValidity();
        signed++;
      }
    }
    if(signed==0) throw new SecurityException("No signed bundle content");
    System.out.println("All "+signed+" bundle payload entries verified with existing upload certificate");
  }
}
