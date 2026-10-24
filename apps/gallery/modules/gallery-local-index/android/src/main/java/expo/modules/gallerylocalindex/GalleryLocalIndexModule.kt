package expo.modules.gallerylocalindex

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.DocumentsContract
import android.util.AtomicFile
import java.io.File
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.functions.Queues
import java.util.ArrayDeque

class GalleryLocalIndexModule : Module() {
  private var pending: Promise? = null
  private val requestCode = 48217
  private fun resolver() = requireNotNull(appContext.reactContext).contentResolver
  private fun localTree(value: String): Uri {
    val uri = Uri.parse(value)
    require(uri.scheme == "content" && uri.authority == "com.android.externalstorage.documents" && DocumentsContract.isTreeUri(uri)) { "Choose a folder in internal storage or on an SD card." }
    return uri
  }
  override fun definition() = ModuleDefinition {
    Name("GalleryLocalIndex")
    AsyncFunction("loadIndexState") {
      val file = File(requireNotNull(appContext.reactContext).filesDir, "gallery-phone-index.json")
      if (file.exists()) AtomicFile(file).openRead().bufferedReader().use { it.readText() } else null
    }
    AsyncFunction("saveIndexState") { state: String ->
      val file = AtomicFile(File(requireNotNull(appContext.reactContext).filesDir, "gallery-phone-index.json"))
      val output = file.startWrite()
      try { output.write(state.toByteArray(Charsets.UTF_8)); file.finishWrite(output) }
      catch (error: Exception) { file.failWrite(output); throw error }
    }
    AsyncFunction("pickFolder") { promise: Promise ->
      if (pending != null) { promise.reject("PICKER_BUSY", "A folder picker is already open.", null); return@AsyncFunction }
      val activity = appContext.currentActivity
      if (activity == null) { promise.reject("NO_ACTIVITY", "Gallery is not in the foreground.", null); return@AsyncFunction }
      pending = promise
      try {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
          flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION or Intent.FLAG_GRANT_PREFIX_URI_PERMISSION
          putExtra("android.content.extra.SHOW_ADVANCED", true)
        }
        activity.startActivityForResult(intent, requestCode)
      } catch (error: Exception) { pending = null; promise.reject("PICKER_FAILED", error.message, error) }
    }.runOnQueue(Queues.MAIN)
    OnActivityResult { _, result ->
      if (result.requestCode == requestCode) {
        val promise = pending
        pending = null
        val value = result.data?.data
        if (result.resultCode != Activity.RESULT_OK || value == null) promise?.resolve(null)
        else try {
          val uri = localTree(value.toString())
          resolver().takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
          val docId = DocumentsContract.getTreeDocumentId(uri)
          val name = docId.substringAfterLast('/').substringAfter(':').ifBlank { "Phone storage" }
          promise?.resolve(mapOf("uri" to uri.toString(), "name" to name))
        } catch (error: Exception) { promise?.reject("FOLDER_ACCESS", error.message, error) }
      }
    }
    OnDestroy { pending?.reject("PICKER_CLOSED", "Folder selection was interrupted.", null); pending = null }
    AsyncFunction("scanFolder") { value: String ->
      val tree = localTree(value)
      val content = resolver()
      require(content.persistedUriPermissions.any { it.uri == tree && it.isReadPermission }) { "Folder permission was removed. Add this folder again." }
      val queue = ArrayDeque<Pair<String, String>>()
      queue.add(DocumentsContract.getTreeDocumentId(tree) to "")
      val visited = HashSet<String>()
      val files = ArrayList<Map<String, Any?>>()
      var complete = true
      var errors = 0
      val columns = arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME, DocumentsContract.Document.COLUMN_MIME_TYPE, DocumentsContract.Document.COLUMN_SIZE, DocumentsContract.Document.COLUMN_LAST_MODIFIED)
      while (queue.isNotEmpty() && files.size < 20000 && visited.size < 20000) {
        val (parent, path) = queue.removeFirst()
        if (!visited.add(parent)) continue
        try {
          val children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, parent)
          val cursor = content.query(children, columns, null, null, null)
          if (cursor == null) { complete = false; errors++; continue }
          cursor.use {
            while (it.moveToNext()) {
              val id = it.getString(0) ?: continue
              val name = it.getString(1) ?: "Unnamed file"
              val mime = it.getString(2) ?: "application/octet-stream"
              val relative = if (path.isEmpty()) name else "$path/$name"
              if (mime == DocumentsContract.Document.MIME_TYPE_DIR) queue.add(id to relative)
              else {
                if (files.size >= 20000) { complete = false; break }
                files.add(mapOf("id" to id, "name" to name, "mimeType" to mime, "size" to if (it.isNull(3)) null else it.getLong(3), "modifiedTime" to if (it.isNull(4)) null else it.getLong(4), "uri" to DocumentsContract.buildDocumentUriUsingTree(tree, id).toString(), "relativePath" to relative))
              }
            }
          }
        } catch (_: Exception) { complete = false; errors++ }
      }
      if (queue.isNotEmpty()) complete = false
      mapOf("files" to files, "complete" to complete, "errors" to errors)
    }
    AsyncFunction("openFile") { value: String, mime: String ->
      val uri = Uri.parse(value)
      require(uri.scheme == "content" && uri.authority == "com.android.externalstorage.documents")
      val intent = Intent(Intent.ACTION_VIEW).apply {
        setDataAndType(uri, mime)
        flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK
      }
      requireNotNull(appContext.reactContext).startActivity(intent)
    }
    AsyncFunction("releaseFolder") { value: String ->
      val uri = localTree(value)
      if (resolver().persistedUriPermissions.any { it.uri == uri && it.isReadPermission }) resolver().releasePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
  }
}
