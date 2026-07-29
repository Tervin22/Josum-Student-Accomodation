param(
  [Parameter(Mandatory = $true)]
  [string]$DocxPath,

  [Parameter(Mandatory = $true)]
  [string]$PdfPath
)

$ErrorActionPreference = "Stop"

$word = $null
$doc = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0

  $doc = $word.Documents.Open($DocxPath, $false, $false)
  $doc.Repaginate()

  foreach ($toc in $doc.TablesOfContents) {
    $toc.Update()
  }

  $story = $doc.StoryRanges.Item(1)
  while ($null -ne $story) {
    $story.Fields.Update() | Out-Null
    $story = $story.NextStoryRange
  }

  foreach ($toc in $doc.TablesOfContents) {
    $toc.UpdatePageNumbers()
  }

  $doc.Repaginate()
  $doc.Save()
  $doc.ExportAsFixedFormat($PdfPath, 17)

  [PSCustomObject]@{
    DocxPath = $DocxPath
    PdfPath = $PdfPath
    Pages = $doc.ComputeStatistics(2)
    TablesOfContents = $doc.TablesOfContents.Count
  } | ConvertTo-Json -Compress
}
finally {
  if ($null -ne $doc) {
    $doc.Close($false)
  }
  if ($null -ne $word) {
    $word.Quit()
  }
}
