/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * These should be run as if the action was called from a workflow.
 * Specifically, the inputs listed in `action.yml` should be set as environment
 * variables following the pattern `INPUT_<INPUT_NAME>`.
 */

import * as core from '@actions/core'
import * as glob from '@actions/glob'
import * as main from '../src/main'

// Mock the action's main function
const runMock = jest.spyOn(main, 'run')

// Mock the GitHub Actions core library
let debugMock: jest.SpiedFunction<typeof core.debug>
let errorMock: jest.SpiedFunction<typeof core.error>
let getInputMock: jest.SpiedFunction<typeof core.getInput>
let setFailedMock: jest.SpiedFunction<typeof core.setFailed>
// let setOutputMock: jest.SpiedFunction<typeof core.setOutput>
let globCreateMock: jest.SpiedFunction<typeof glob.create>

describe('action', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    debugMock = jest.spyOn(core, 'debug').mockImplementation()
    errorMock = jest.spyOn(core, 'error').mockImplementation()
    getInputMock = jest.spyOn(core, 'getInput').mockImplementation()
    setFailedMock = jest.spyOn(core, 'setFailed').mockImplementation()
    // setOutputMock = jest.spyOn(core, 'setOutput').mockImplementation()
    globCreateMock = jest.spyOn(glob, 'create').mockImplementation()
  })

  it('runs without failure', async () => {
    // Set the action's inputs as return values from core.getInput()
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'follow-symbolic-links':
          return 'TRUE'
        case 'file-patterns':
          return '**glob'
        default:
          return ''
      }
    })
    const globGeneratorMock = jest.fn(async function* globGenerator() {
      yield '/mock'
    })

    globCreateMock.mockImplementation(
      async () =>
        ({
          globGenerator: globGeneratorMock
        }) as unknown as glob.Globber
    )

    await main.run()
    expect(runMock).toHaveReturned()

    // Verify that all of the core library functions were called correctly
    expect(globCreateMock).toHaveBeenCalledWith('**glob', {
      followSymbolicLinks: true
    })
    expect(globGeneratorMock).toHaveBeenCalled()

    expect(debugMock).toHaveBeenNthCalledWith(1, 'Got file: /mock')
    expect(errorMock).not.toHaveBeenCalled()
    expect(setFailedMock).not.toHaveBeenCalled()
  })
})
