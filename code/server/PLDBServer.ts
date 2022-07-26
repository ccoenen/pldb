#!/usr/bin/env ts-node

const path = require("path")
const express = require("express")
const { Disk } = require("jtree/products/Disk.node.js")
const { TreeBaseServer } = require("jtree/products/treeBase.node.js")
import { PLDBBaseFolder } from "../PLDBBase"
import { runCommand } from "../utils"

const header = `<title>PLDB Editor</title><div>
<a href="/"><b>PLDB Editor</b></a> | <a href="/edit">List all</a> | <a href="/create">Create</a>
</div><br>`

const editForm = (content = "") =>
	`${header}
<form method="POST"><textarea name="content" style="width: 50%; height: 80%;">${htmlEscaped(
		content
	)}</textarea><br><br><input type="submit" value="Save" id="submitButton"/></form>`

const htmlEscaped = (content: string) => content.replace(/</g, "&lt;")

const keyboardNav = file => `<script src="/libs.js"></script>
 <script>
  Mousetrap.bind("mod+s", (evt) => {document.getElementById("submitButton").click(); evt.preventDefault(); return false;})
  Mousetrap.bind("left", () => {window.location = "${file.previousRanked.id}"})
  Mousetrap.bind("right", () => {window.location = "${file.nextRanked.id}"})
 </script>`

class PLDBServer extends TreeBaseServer {
	checkAndPrettifySubmission(content: string) {
		return this._folder.prettifyContent(content)
	}

	indexCommand() {
		return `${header}
<div style="white-space:pre;">
-- Folder: '${this._folder._getDir()}'
-- Grammars: '${this._folder._getGrammarPaths().join(",")}'
-- Files: ${this._folder.length}
-- Bytes: ${this._folder.toString().length}
</pre>
<a href="errors.html">Errors (HTML)</a> | <a href="errors.csv">Errors (CSV)</a>`
	}

	addRoutes() {
		const app = this._app
		const pldbBase = this._folder

		const publicFolder = path.join(__dirname, "..", "..", "blog", "public")

		app.use(express.static(publicFolder))

		app.get("/create", (req, res) => res.send(editForm()))

		app.post("/create", (req, res) => {
			try {
				const newFile = pldbBase.createFile(
					this.checkAndPrettifySubmission(req.body.content)
				)
				res.redirect("edit/" + newFile.id)
			} catch (err) {
				errorForm(req.body.content, err, res)
			}
		})

		const errorForm = (submission, err, res) => {
			res.status(500)
			res.send(
				`<div style="color: red;">Error: ${err}</div>` + editForm(submission)
			)
		}

		const notFound = (id, res) => {
			res.status(500)
			return res.send(`"${htmlEscaped(id)}" not found`)
		}

		app.get("/edit", (req, res) =>
			res.send(
				header +
					this._folder.topLanguages
						.map(file => `<a href="edit/${file.id}">${file.getFileName()}</a>`)
						.join("<br>")
			)
		)

		app.get("/edit/:id", (req, res) => {
			const { id } = req.params
			if (id.endsWith(".pldb")) return res.redirect(id.replace(".pldb", ""))

			const file = pldbBase.getFile(id)
			if (!file) return notFound(id, res)

			res.send(editForm(file.childrenToString()) + keyboardNav(file))
		})

		app.post("/edit/:id", (req, res) => {
			const { id } = req.params
			const file = pldbBase.getFile(id)
			if (!file) return notFound(id, res)

			try {
				file.setChildren(this.checkAndPrettifySubmission(req.body.content))
				file.save()
				res.redirect(id)
			} catch (err) {
				errorForm(req.body.content, err, res)
			}
		})
	}
}

class PLDBServerCommands {
	launchServerCommand(port) {
		const pldbBase = PLDBBaseFolder.getBase()
		pldbBase.loadFolder()
		pldbBase.startListeningForFileChanges()
		const server = new (<any>PLDBServer)(pldbBase)
		server.addRoutes()
		server.listen(port)
	}

	serveFolderCommand(
		port = 3030,
		folder = path.join(__dirname, "..", "..", "pldb.pub")
	) {
		const app = express()
		app.use(express.static(folder))
		app.listen(port)
		console.log(`Serving '${folder}'. cmd+dblclick: http://localhost:${port}/`)
	}
}

export { PLDBServer }

if (!module.parent)
	runCommand(new PLDBServerCommands(), process.argv[2], process.argv[3])