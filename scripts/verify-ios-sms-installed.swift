import Foundation
import CryptoKit

func command(_ args:[String]) throws -> String {
    let task=Process();task.executableURL=URL(fileURLWithPath:"/usr/bin/xcrun");task.arguments=args
    let output=Pipe();task.standardOutput=output;task.standardError=FileHandle.standardError
    try task.run();let data=output.fileHandleForReading.readDataToEndOfFile();task.waitUntilExit()
    guard task.terminationStatus==0 else {throw NSError(domain:"NITIDO",code:Int(task.terminationStatus))}
    return String(data:data,encoding:.utf8)!.trimmingCharacters(in:.whitespacesAndNewlines)
}
let app=URL(fileURLWithPath:CommandLine.arguments[1])
let bundleAudio=try Data(contentsOf:app.appendingPathComponent("nitido_alert_v2.wav"))
let expected="447400c377f97a0f61a119f77b6c2810c564f7646b3d7c4c7e7316ab90436459"
let hash=SHA256.hash(data:bundleAudio).map {String(format:"%02x",$0)}.joined()
guard hash==expected else {fatalError("SMS bundle audio differs from verified asset")}
let runtimeData=try command(["simctl","list","runtimes","--json"])
let runtimeJSON=try JSONSerialization.jsonObject(with:runtimeData.data(using:.utf8)!) as! [String:Any]
let runtimes=(runtimeJSON["runtimes"] as! [[String:Any]]).filter {($0["identifier"] as? String)?.contains("iOS-26")==true && ($0["isAvailable"] as? Bool)==true}
guard let runtime=runtimes.last?["identifier"] as? String else {fatalError("No available iOS26 simulator")}
let device=try command(["simctl","create","NITIDO SMS candidate 20261024","com.apple.CoreSimulator.SimDeviceType.iPhone-17",runtime])
defer { _ = try? command(["simctl","shutdown",device]); _ = try? command(["simctl","delete",device]) }
_ = try command(["simctl","boot",device])
_ = try command(["simctl","bootstatus",device,"-b"])
_ = try command(["simctl","install",device,app.path])
var results:[[String:Any]]=[]
for attempt in 1...2 {
    _ = try command(["simctl","launch",device,"ro.nitido.app"])
    let container=try command(["simctl","get_app_container",device,"ro.nitido.app","data"])
    let installed=URL(fileURLWithPath:container).appendingPathComponent("Library/Sounds/nitido_sms_v1.wav")
    var data:Data?=nil
    for _ in 0..<30 {
        data=try? Data(contentsOf:installed)
        if data != nil {break}
        Thread.sleep(forTimeInterval:0.5)
    }
    guard data==bundleAudio else {fatalError("SMS notification audio missing from Library/Sounds")}
    results.append(["launch":attempt,"librarySoundMatchesBundle":true])
    _ = try command(["simctl","terminate",device,"ro.nitido.app"])
}
let report:[String:Any] = ["bundleAssetSha256":hash,"apnsFilename":"nitido_sms_v1.wav","runtime":runtime,"checks":results,"physicalDeviceAudibilityTested":false,"signedOrUploaded":false]
let destination=URL(fileURLWithPath:".ios-sms-evidence")
try FileManager.default.createDirectory(at:destination,withIntermediateDirectories:true)
try JSONSerialization.data(withJSONObject:report,options:[.prettyPrinted,.sortedKeys]).write(to:destination.appendingPathComponent("native-copy-proof.json"))
print(String(data:try JSONSerialization.data(withJSONObject:report,options:[.sortedKeys]),encoding:.utf8)!)
