import * as core from '@actions/core'
import * as glob from '@actions/glob'
// import * as io from '@actions/io'
import * as fs from 'fs'
import * as path from 'path'
import * as process from 'process'

async function parsePatterns(
  patterns: string[],
  source: string,
  patternInput: string,
  allowIncludes = true,
  invert = false
): Promise<void> {
  for (let patternLine of patternInput.trim().replace(/\r/g, '').split('\n')) {
    patternLine = patternLine.trim()
    if (!patternLine || patternLine.startsWith('#')) continue
    const patternMatch = /^(!?)(@?)\s*(.+)$/.exec(patternLine)
    if (allowIncludes && patternMatch?.[2]) {
      const invertInclude = patternMatch[1] === '!'
      const filename = patternMatch[3]
      core.debug(`Parsing patterns from file ${filename}`)
      const fileContent = await fs.promises.readFile(filename, {
        encoding: 'utf-8'
      })
      await parsePatterns(patterns, filename, fileContent, false, invertInclude)
      core.debug(`Loaded patterns from file ${filename}`)
      continue
    }
    if (invert) patternLine = `!${patternLine}`
    core.debug(`Adding ${patternLine} from ${source}`)
    patterns.push(patternLine)
  }
}

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

    const patterns: string[] = []

    await parsePatterns(patterns, '<input>', input.filePatterns)

    if (input.useGitignore && fs.existsSync('.gitignore')) {
      await parsePatterns(patterns, '<gitignore>', '!@.gitignore')
    }

    const globber = await glob.create(patterns.join('\n'), globOptions)

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
