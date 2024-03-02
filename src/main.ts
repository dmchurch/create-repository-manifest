import * as core from '@actions/core'
import * as glob from '@actions/glob'
// import * as io from '@actions/io'
import * as fs from 'fs'
import * as path from 'path'
import * as process from 'process'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const input = {
      filePatterns: core.getInput('file-patterns'),
      followSymbolicLinks: core.getBooleanInput('follow-symbolic-links'),
      useGitignore: core.getBooleanInput('use-gitignore'),
      minify: core.getBooleanInput('minify'),
      manifestPath: core.getInput('manifest-path'),
      summaryPath: core.getInput('summary-path')
    }

    if (input.manifestPath?.startsWith('/')) {
      input.manifestPath = input.manifestPath.slice(1)
    }

    if (input.summaryPath?.startsWith('/')) {
      input.summaryPath = input.summaryPath.slice(1)
    }

    const globOptions: glob.GlobOptions = {
      matchDirectories: false,
      followSymbolicLinks: input.followSymbolicLinks
    }

    let patterns = input.filePatterns
    const match = /^@((?:\.\/)?(?:[^\s/]+\/)*[^\s/]+\/?)$/.exec(patterns.trim())
    if (match) {
      const filename = match[1]
      if (filename && fs.existsSync(filename)) {
        const patternFile = await fs.promises.readFile(filename, {
          encoding: 'utf-8'
        })
        const filePatterns: string[] = []
        for (let patternLine of patternFile.replace(/\r/g, '').split('\n')) {
          patternLine = patternLine.trim()
          if (!patternLine || patternLine.startsWith('#')) continue
          core.debug(`Adding ${patternLine} from ${filename}`)
          filePatterns.push(patternLine)
        }
        patterns = filePatterns.join('\n')
        core.debug(`Loaded patterns from file ${filename}`)
      }
    }
    if (input.useGitignore && fs.existsSync('.gitignore')) {
      const ignores = await fs.promises.readFile('.gitignore', {
        encoding: 'utf-8'
      })
      for (let ignoreLine of ignores.replace(/\r/g, '').split('\n')) {
        ignoreLine = ignoreLine.trim()
        if (!ignoreLine || ignoreLine.startsWith('#')) continue
        core.debug(`Adding !${ignoreLine} from .gitignore`)
        patterns += `\n!${ignoreLine}`
      }
    }
    const globber = await glob.create(patterns, globOptions)

    const base = process.cwd()
    const files: Record<string, string | null> = {}
    for await (const file of globber.globGenerator()) {
      const relFile = path.posix.relative(base, file)
      if (relFile.startsWith(`.git/`)) {
        // never record anything in the .git directory
        continue
      }
      core.debug(`Got file: ${relFile}`)
      files[relFile] = null
    }

    core.debug(
      `Found ${Object.keys(files).length} files, writing to ${input.manifestPath}`
    )
    await fs.promises.writeFile(
      input.manifestPath,
      JSON.stringify({ files }, null, input.minify ? undefined : 4),
      { encoding: 'utf-8' }
    )
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
