using System;
using System.IO;
using System.Diagnostics;
using System.Net.Sockets;
using System.Windows.Forms;
using System.Reflection;
[assembly: AssemblyTitle("HomeKanban")]
[assembly: AssemblyProduct("HomeKanban")]
[assembly: AssemblyDescription("Offline Home Inspection Reports")]
[assembly: AssemblyVersion("0.18.66.0")]
[assembly: AssemblyFileVersion("0.18.66.0")]
class Launcher {
 [STAThread] static void Main() {
  try {
   string root=AppDomain.CurrentDomain.BaseDirectory;
   string node=Path.Combine(root,"runtime","node.exe"), server=Path.Combine(root,"app","server.js");
   if(!File.Exists(node)||!File.Exists(server)){MessageBox.Show("Please extract the entire ZIP before launching. Keep app and runtime folders beside HomeKanban.exe.","HomeKanban");return;}
   // Reopening an existing instance must not create a second database writer.
   bool running=false;
   try{using(var socket=new TcpClient()){var connect=socket.ConnectAsync("127.0.0.1",38473);running=connect.Wait(500)&&socket.Connected;}}catch{}
   if(running){Process.Start(new ProcessStartInfo("http://127.0.0.1:38473"){UseShellExecute=true});return;}
   Process.Start(new ProcessStartInfo(node,"\""+server+"\""){WorkingDirectory=root,UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden});
  } catch(Exception e) {MessageBox.Show("Unable to start HomeKanban: "+e.Message,"HomeKanban");}
 }
}
