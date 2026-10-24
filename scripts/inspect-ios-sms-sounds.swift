import Foundation
import CryptoKit

let fm=FileManager.default
let input=URL(fileURLWithPath:"/tmp/nitido-ios-runtimes.json")
let raw=try JSONSerialization.jsonObject(with:Data(contentsOf:input)) as! [String:Any]
let runtimes=raw["runtimes"] as? [[String:Any]] ?? []
let out=URL(fileURLWithPath:fm.currentDirectoryPath).appendingPathComponent(".ios-sms-evidence")
try fm.createDirectory(at:out,withIntermediateDirectories:true)
var report:[[String:Any]]=[]
for runtime in runtimes {
 guard let identifier=runtime["identifier"] as? String,identifier.contains("iOS"),let bundle=runtime["bundlePath"] as? String else {continue}
 let root=URL(fileURLWithPath:bundle).appendingPathComponent("Contents/Resources/RuntimeRoot/System/Library/Audio/UISounds")
 var files:[[String:Any]]=[]
 if let iterator=fm.enumerator(at:root,includingPropertiesForKeys:[.isRegularFileKey],options:[.skipsHiddenFiles]) {
  for case let file as URL in iterator {
   let name=file.lastPathComponent.lowercased()
   guard name=="note.caf" || name=="sms_alert_note.caf" || name=="sms-received1.caf" else {continue}
   let data=try Data(contentsOf:file)
   let nameOut=identifier+"-"+file.lastPathComponent
   let target=out.appendingPathComponent(nameOut)
   try data.write(to:target)
   let hash=SHA256.hash(data:data).map {String(format:"%02x",$0)}.joined()
   files.append(["name":file.lastPathComponent,"relativePath":file.path.replacingOccurrences(of:root.path+"/",with:""),"sha256":hash,"bytes":data.count,"artifactName":nameOut])
  }
 }
 report.append(["runtime":identifier,"version":runtime["version"] ?? "unknown","files":files])
}
let evidence:[String:Any] = ["source":"Installed Apple iOS Simulator runtime; no device or account data","runtimes":report,"appProjectModified":false,"publishedToStore":false]
try JSONSerialization.data(withJSONObject:evidence,options:[.prettyPrinted,.sortedKeys]).write(to:out.appendingPathComponent("inventory.json"))
print(String(data:try JSONSerialization.data(withJSONObject:evidence,options:[.sortedKeys]),encoding:.utf8)!)
