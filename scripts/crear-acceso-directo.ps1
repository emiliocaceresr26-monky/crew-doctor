# Creates a "Crew Doctor" shortcut on the Windows desktop with the app logo as its icon.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$ico = Join-Path $PSScriptRoot 'crew-doctor.ico'

# Build a Windows icon from public/logo.png (a PNG wrapped in an ICO header).
if (-not (Test-Path $ico)) {
  Add-Type -AssemblyName System.Drawing
  $src = [System.Drawing.Image]::FromFile((Join-Path $root 'public\logo.png'))
  $bmp = New-Object System.Drawing.Bitmap 256, 256
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.DrawImage($src, 0, 0, 256, 256)
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $png = $ms.ToArray()
  $g.Dispose(); $bmp.Dispose(); $src.Dispose()
  $fs = [System.IO.File]::Create($ico)
  $w = New-Object System.IO.BinaryWriter $fs
  $w.Write([UInt16]0); $w.Write([UInt16]1); $w.Write([UInt16]1)          # header: icon, 1 image
  $w.Write([Byte]0); $w.Write([Byte]0); $w.Write([Byte]0); $w.Write([Byte]0) # 256x256, no palette
  $w.Write([UInt16]1); $w.Write([UInt16]32); $w.Write([UInt32]$png.Length); $w.Write([UInt32]22)
  $w.Write($png); $w.Close()
}

$desktop = [Environment]::GetFolderPath('Desktop')
$lnk = Join-Path $desktop 'Crew Doctor.lnk'
$shell = New-Object -ComObject WScript.Shell
$s = $shell.CreateShortcut($lnk)
$s.TargetPath = Join-Path $root 'Abrir Crew Doctor.cmd'
$s.WorkingDirectory = $root
$s.IconLocation = "$ico,0"
$s.WindowStyle = 7   # minimized: only the browser shows up
$s.Description = 'Abrir Crew Doctor'
$s.Save()
"Acceso directo creado: $lnk"
