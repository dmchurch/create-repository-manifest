/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * These should be run as if the action was called from a workflow.
 * Specifically, the inputs listed in `action.yml` should be set as environment
 * variables following the pattern `INPUT_<INPUT_NAME>`.
 */

import * as core from '@actions/core'
import * as glob from '@actions/glob'
import * as fs from 'fs'
import * as process from 'process'

import * as main from '../src/main'

// Mock the action's main function
const runMock = jest.spyOn(main, 'run')

// Mock the GitHub Actions core library
let debugMock: jest.SpiedFunction<typeof core.debug>
let errorMock: jest.SpiedFunction<typeof core.error>
let getInputMock: jest.SpiedFunction<typeof core.getInput>
let getBooleanInputMock: jest.SpiedFunction<typeof core.getBooleanInput>
let setFailedMock: jest.SpiedFunction<typeof core.setFailed>
// let setOutputMock: jest.SpiedFunction<typeof core.setOutput>
let globCreateMock: jest.SpiedFunction<typeof glob.create>
let globGeneratorMock: jest.SpiedFunction<glob.Globber['globGenerator']>

const globGeneratorResults: string[] = []
let readFileResults: Record<string, string> = {}

// mock native calls
let existsSyncMock: jest.SpiedFunction<typeof fs.existsSync>
let writeFileMock: jest.SpiedFunction<typeof fs.promises.writeFile>
let readFileMock: jest.SpiedFunction<typeof fs.promises.readFile>
jest.mock('fs', () => ({
  existsSync: jest.fn().mockName('existsSync').mockImplementation(),
  promises: {
    writeFile: jest
      .fn()
      .mockName('promises.writeFile')
      .mockResolvedValue(undefined),
    readFile: jest
      .fn<unknown, Parameters<typeof fs.promises.readFile>>()
      .mockName('promises.readFile')
      .mockImplementation((path, options) => {
        const result =
          String(path) in readFileResults ? readFileResults[String(path)] : ''
        return options ? result : Buffer.from(result)
      })
  }
}))

const defaultStringInputs: Record<string, string> = {
  'file-patterns': '**',
  'manifest-path': 'repository-manifest.json',
  'summary-path': ''
}
const defaultBooleanInputs: Record<string, boolean> = {
  'follow-symbolic-links': true,
  'use-gitignore': true,
  minify: true
}

let stringInputs: typeof defaultStringInputs
let booleanInputs: typeof defaultBooleanInputs

describe('action', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    stringInputs = { ...defaultStringInputs }
    booleanInputs = { ...defaultBooleanInputs }
    globGeneratorResults.length = 0
    readFileResults = {}

    debugMock = jest.spyOn(core, 'debug').mockImplementation()
    errorMock = jest.spyOn(core, 'error').mockImplementation()
    getInputMock = jest
      .spyOn(core, 'getInput')
      .mockImplementation(name => stringInputs[name] ?? '')
    getBooleanInputMock = jest
      .spyOn(core, 'getBooleanInput')
      .mockImplementation(name => booleanInputs[name] ?? false)
    setFailedMock = jest.spyOn(core, 'setFailed').mockImplementation()
    // setOutputMock = jest.spyOn(core, 'setOutput').mockImplementation()

    globGeneratorMock = jest.fn(async function* globGenerator() {
      const cwd = process.cwd()
      for (const file of globGeneratorResults) {
        yield `${cwd}/${file}`
      }
    })
    globCreateMock = jest.spyOn(glob, 'create').mockImplementation(
      async () =>
        ({
          globGenerator: globGeneratorMock
        }) as unknown as glob.Globber
    )

    existsSyncMock = fs.existsSync as unknown as typeof existsSyncMock
    writeFileMock = fs.promises.writeFile as unknown as typeof writeFileMock
    readFileMock = fs.promises.readFile as unknown as typeof readFileMock
  })

  it('runs without failure', async () => {
    // Set the action's inputs as return values from core.get*Input()
    stringInputs = {
      'file-patterns': '**glob',
      'manifest-path': 'mockManifest',
      'summary-path': ''
    }
    booleanInputs = {
      'follow-symbolic-links': true,
      'use-gitignore': false,
      minify: true
    }
    existsSyncMock.mockReturnValue(false)

    globGeneratorResults.push('mock')

    await main.run()
    expect(runMock).toHaveReturned()

    // Verify that all of the core library functions were called correctly
    expect(getInputMock).toHaveBeenCalled()
    expect(getBooleanInputMock).toHaveBeenCalled()
    expect(globCreateMock).toHaveBeenCalledWith('**glob', {
      matchDirectories: false,
      followSymbolicLinks: true
    })
    expect(globGeneratorMock).toHaveBeenCalled()

    expect(debugMock).toHaveBeenNthCalledWith(1, 'Adding **glob from <input>')
    expect(debugMock).toHaveBeenNthCalledWith(2, 'Got file: mock')
    expect(debugMock).toHaveBeenNthCalledWith(
      3,
      'Found 1 files, writing to mockManifest'
    )
    expect(writeFileMock).toHaveBeenCalledWith(
      'mockManifest',
      '{"files":{"mock":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"}}',
      { encoding: 'utf-8' }
    )

    expect(existsSyncMock).not.toHaveBeenCalled()
    expect(errorMock).not.toHaveBeenCalled()
    expect(setFailedMock).not.toHaveBeenCalled()
  })

  it('ignores files under .git/', async () => {
    existsSyncMock.mockReturnValue(false)

    globGeneratorResults.push('file1', '.git/file2', 'dir/file3')

    await main.run()
    expect(runMock).toHaveReturned()

    expect(writeFileMock).toHaveBeenCalledWith(
      'repository-manifest.json',
      '{"files":{"file1":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","dir/file3":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"}}',
      { encoding: 'utf-8' }
    )

    expect(errorMock).not.toHaveBeenCalled()
    expect(setFailedMock).not.toHaveBeenCalled()
  })

  it('removes a leading / from manifestPath and summaryPath', async () => {
    stringInputs['manifest-path'] = '/test-manifest'
    stringInputs['summary-path'] = '/test-summary'

    booleanInputs['use-gitignore'] = false

    await main.run()
    expect(runMock).toHaveReturned()
    expect(setFailedMock).not.toHaveBeenCalled()
    expect(writeFileMock).toHaveBeenCalledWith(
      'test-manifest',
      '{"files":{}}',
      { encoding: 'utf-8' }
    )
  })

  it('reads patterns from files in the repository', async () => {
    stringInputs['file-patterns'] = '@test-patterns'

    existsSyncMock.mockReturnValue(true)
    readFileResults['test-patterns'] = 'file1\n\nfile2\n'
    readFileResults['.gitignore'] = 'ignore1\n#comment\nignore2'

    await main.run()
    expect(runMock).toHaveReturned()
    expect(setFailedMock).not.toHaveBeenCalled()

    expect(existsSyncMock).toHaveBeenNthCalledWith(1, '.gitignore')

    expect(globCreateMock).toHaveBeenCalledWith(
      'file1\nfile2\n!ignore1\n!ignore2',
      {
        matchDirectories: false,
        followSymbolicLinks: true
      }
    )
  })

  it('prints prettily when asked', async () => {
    booleanInputs['minify'] = false

    await main.run()
    expect(runMock).toHaveReturned()
    expect(setFailedMock).not.toHaveBeenCalled()

    expect(writeFileMock).toHaveBeenCalledWith(
      'repository-manifest.json',
      '{\n    "files": {}\n}',
      { encoding: 'utf-8' }
    )
  })
  it('fails cleanly on error', async () => {
    globCreateMock.mockImplementation(() => {
      throw new Error('Mock error')
    })

    await main.run()
    expect(runMock).toHaveReturned()
    expect(setFailedMock).toHaveBeenCalled()
  })
})
