using System;
using System.IO;
using System.Reflection;
using System.Diagnostics;
using System.Windows.Forms;
[assembly: AssemblyTitle("HomeKanban")]
[assembly: AssemblyProduct("HomeKanban")]
[assembly: AssemblyDescription("HomeKanban desktop launcher")]
[assembly: AssemblyVersion("0.18.1.0")]
[assembly: AssemblyFileVersion("0.18.1.0")]
class DesktopLauncher {
 [STAThread] static void Main() {
  try {
   string target;
   using(var stream=Assembly.GetExecutingAssembly().GetManifestResourceStream("installation-path.txt"))
   using(var reader=new StreamReader(stream)){target=reader.ReadToEnd().Trim();}
   if(!File.Exists(target))throw new FileNotFoundException("The HomeKanban installation has moved. Please recreate this desktop launcher from its installation folder.");
   Process.Start(new ProcessStartInfo(target){WorkingDirectory=Path.GetDirectoryName(target),UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden});
  }catch(Exception e){MessageBox.Show("Unable to open HomeKanban: "+e.Message,"HomeKanban");}
 }
}
