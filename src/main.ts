import * as core from '@actions/core'
import * as glob from '@actions/glob'

const globOptions: glob.GlobOptions = {
  followSymbolicLinks: core.getInput('follow-symbolic-links') !== 'FALSE'
}

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const globber = await glob.create(
      core.getInput('file-patterns'),
      globOptions
    )
    for await (const file of globber.globGenerator()) {
      core.debug(`Got file: ${file}`)
    }
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
